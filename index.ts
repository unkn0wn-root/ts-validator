/**
 * Represents a validation issue that occurred during schema validation.
 * Contains detailed information about what went wrong and where.
 */
export interface ValidationIssue {
	path: (string | number)[]; // The path to the invalid value in the data structure (e.g., ['user', 'address', 'zipCode'])
	message: string;
	expected: string; // The type or value that was expected
	received: string; // The type or value that was actually received
}

/**
 * ValidationError represents one or more validation issues.
 * Thrown when data does not match the schema.
 */
export class ValidationError extends Error {
	constructor(public issues: ValidationIssue[]) {
		super('Validation failed');
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = 'ValidationError';
	}
}

/**
 * Helper function to create a ValidationError for a single issue.
 */
function makeError(path: (string | number)[], expected: string, received: string, value: unknown): ValidationError {
	return new ValidationError([
		{
			path,
			message: `Invalid value at "${path.join('.')}": expected ${expected}, received ${received}. Value: ${JSON.stringify(value)}`,
			expected,
			received,
		},
	]);
}

/**
 * VType<T> is the abstract base class for all schema types.
 * It provides parse methods and supports optional/nullable and refinements.
 */
abstract class VType<T> {
	// A list of refinement functions for custom validation logic.
	private refinements: Array<{ check: (val: T) => boolean; message: string }> = [];

	/**
	 * Internal parsing logic implemented by subclasses.
	 * If parsing fails, should throw ValidationError.
	 */
	protected abstract _parse(path: (string | number)[], data: unknown): T;

	/**
	 * Parses the input data. Throws ValidationError if it fails.
	 */
	parse(data: unknown): T {
		return this._parseWithRefinements([], data);
	}

	protected _parseWithRefinements(path: (string | number)[], data: unknown): T {
		const value = this._parse(path, data);
		this.runRefinements(value, path);
		return value;
	}

	/**
	 * Safely parses the input data. Returns a success/failure object instead of throwing.
	 */
	safeParse(data: unknown): { success: true; data: T } | { success: false; error: ValidationError } {
		try {
			const parsed = this._parse([], data);
			this.runRefinements(parsed, []);
			return { success: true, data: parsed };
		} catch (err) {
			if (err instanceof ValidationError) {
				return { success: false, error: err };
			}
			throw err;
		}
	}

	/**
	 * Marks this type as optional, allowing undefined values.
	 */
	optional(): VType<T | undefined> {
		return new VOptional(this);
	}

	/**
	 * Marks this type as nullable, allowing null values.
	 */
	nullable(): VType<T | null> {
		return new VNullable(this);
	}

	/**
	 * Adds a refinement for custom validation logic.
	 * If check function returns false, parsing will fail with the provided message.
	 */
	refine(check: (value: T) => boolean, message = 'Refinement failed'): this {
		this.refinements.push({ check, message });
		return this;
	}

	/**
	 * Run all refinements. If any fail, throw a ValidationError.
	 */
	private runRefinements(value: T, path: (string | number)[]): void {
		for (const { check, message } of this.refinements) {
			if (!check(value)) {
				throw new ValidationError([
					{
						path,
						message,
						expected: 'refinement to pass',
						received: typeof value,
					},
				]);
			}
		}
	}

	/**
	 * A type-level helper to extract the TypeScript type of this schema.
	 */
	get _type(): T {
		// This is never actually called at runtime, it's for TypeScript inference only.
		throw new Error("Do not call _type at runtime, it's a type-level property only.");
	}
}

/**
 * Wraps another schema to allow undefined values.
 */
class VOptional<T> extends VType<T | undefined> {
	constructor(private inner: VType<T>) {
		super();
	}

	protected _parse(path: (string | number)[], data: unknown): T | undefined {
		if (data === undefined) return undefined;
		const value = this.inner['_parse'](path, data);
		return value;
	}
}

/**
 * Wraps another schema to allow null values.
 */
class VNullable<T> extends VType<T | null> {
	constructor(private inner: VType<T>) {
		super();
	}

	protected _parse(path: (string | number)[], data: unknown): T | null {
		if (data === null) return null;
		const value = this.inner['_parse'](path, data);
		return value;
	}
}

/**
 * Schema type for string validation.
 * @example
 * ```ts
 * const nameSchema = validator.string();
 * // Optional: nameSchema.refine(s => s.length > 0, "String cannot be empty");
 * ```
 */
class VString extends VType<string> {
	protected _parse(path: (string | number)[], data: unknown): string {
		if (typeof data !== 'string') {
			throw makeError(path, 'string', typeof data, data);
		}
		return data;
	}
}

/**
 * Schema type for number validation.
 * Rejects NaN values.
 * @example
 * ```ts
 * const ageSchema = validator.number();
 * // Optional: ageSchema.refine(n => n >= 0, "Age must be non-negative");
 * ```
 */
class VNumber extends VType<number> {
	protected _parse(path: (string | number)[], data: unknown): number {
		if (typeof data !== 'number' || isNaN(data)) {
			throw makeError(path, 'number', typeof data, data);
		}
		return data;
	}
}

/**
 * Schema type for boolean validation.
 * @example
 * ```ts
 * const isActiveSchema = validator.boolean();
 * ```
 */
class VBoolean extends VType<boolean> {
	protected _parse(path: (string | number)[], data: unknown): boolean {
		if (typeof data !== 'boolean') {
			throw makeError(path, 'boolean', typeof data, data);
		}
		return data;
	}
}

/**
 * Schema type for Date validation.
 * Rejects invalid dates (where getTime() returns NaN).
 * @example
 * ```ts
 * const birthDateSchema = validator.date();
 * ```
 */
class VDate extends VType<Date> {
	protected _parse(path: (string | number)[], data: unknown): Date {
		if (!(data instanceof Date) || isNaN(data.getTime())) {
			throw makeError(path, 'Date', typeof data, data);
		}
		return data;
	}
}

/**
 * Schema type for array validation.
 * Validates each element against the provided element schema.
 * @example
 * ```ts
 * const numbersSchema = validator.array(validator.number());
 * ```
 */
class VArray<T> extends VType<T[]> {
	constructor(private element: VType<T>) {
		super();
	}

	protected _parse(path: (string | number)[], data: unknown): T[] {
		if (!Array.isArray(data)) {
			throw makeError(path, 'array', typeof data, data);
		}
		return data.map((item, i) => this.element['_parse']([...path, i], item));
	}
}

/**
 * Schema type for literal value validation.
 * Ensures a value exactly matches the provided literal.
 * @example
 * ```ts
 * const statusSchema = validator.literal("active");
 * ```
 */
class VLiteral<T extends string | number | boolean> extends VType<T> {
	constructor(private val: T) {
		super();
	}

	protected _parse(path: (string | number)[], data: unknown): T {
		if (data !== this.val) {
			throw makeError(path, `literal ${JSON.stringify(this.val)}`, typeof data, data);
		}
		return this.val;
	}
}

/**
 * Schema type for union validation.
 * Tries each provided schema until one succeeds.
 * @example
 * ```ts
 * const stringOrNumber = validator.union([
 *   validator.string(),
 *   validator.number()
 * ]);
 * ```
 */
class VUnion<T> extends VType<T> {
	constructor(private options: VType<any>[]) {
		super();
	}

	protected _parse(path: (string | number)[], data: unknown): T {
		const errors: ValidationIssue[] = [];
		for (const option of this.options) {
			try {
				return option['_parse'](path, data);
			} catch (err) {
				if (err instanceof ValidationError) {
					errors.push(...err.issues);
				} else {
					throw err;
				}
			}
		}
		// If all options fail, combine their errors
		throw new ValidationError(errors);
	}
}

type VShape = { [key: string]: VType<any> };

/**
 * VObject defines a schema for objects.
 * Unknown keys are discarded.
 */
class VObject<T extends VShape> extends VType<{ [K in keyof T]: T[K]['_type'] }> {
	constructor(private shape: T) {
		super();
	}

	protected _parse(path: (string | number)[], data: unknown): { [K in keyof T]: T[K]['_type'] } {
		if (typeof data !== 'object' || data === null) {
			throw makeError(path, 'object', typeof data, data);
		}
		const obj = data as Record<string, unknown>;
		const result: Record<string, unknown> = {};

		for (const key in this.shape) {
			const val = obj[key];
			const schema = this.shape[key];
			result[key] = schema['_parseWithRefinements']([...path, key], val);
		}

		// Discard unknown properties (those not in the shape)
		// We do nothing with extra keys, effectively discarding them.
		return result as { [K in keyof T]: T[K]['_type'] };
	}
}

/**
 * The `validator` namespace provides factory functions to create schemas.
 * It mimics the Zod-like interface but implemented in this custom library.
 */
export const validator = {
	string: () => new VString(),
	number: () => new VNumber(),
	boolean: () => new VBoolean(),
	date: () => new VDate(),
	array: <T>(schema: VType<T>) => new VArray(schema),
	literal: <L extends string | number | boolean>(val: L) => new VLiteral(val),
	union: <U extends [VType<any>, ...VType<any>[]]>(schemas: U) => new VUnion<any>(schemas),
	object: <S extends VShape>(shape: S) => new VObject(shape),

	// Extract the inferred type from a schema
	// Using `schema._type` as the authoritative type.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
	infer: <U extends VType<any>>(schema: U): U['_type'] => {
		// Type-level only, no runtime logic needed.
		throw new Error("Do not call validator.infer at runtime. It's a type-level utility only.");
	},

	// Error classes for external usage
	ValidationError,
};

import { validator } from '../index';

describe('Validator', () => {
	describe('string()', () => {
		const schema = validator.string();

		it('should accept valid strings', () => {
			expect(schema.parse('hello')).toBe('hello');
			expect(schema.parse('')).toBe('');
		});

		it('should reject non-strings', () => {
			expect(() => schema.parse(123)).toThrow(validator.ValidationError);
			expect(() => schema.parse(null)).toThrow(validator.ValidationError);
			expect(() => schema.parse(undefined)).toThrow(validator.ValidationError);
			expect(() => schema.parse({})).toThrow(validator.ValidationError);
		});

		it('should handle optional strings', () => {
			const optionalSchema = schema.optional();
			expect(optionalSchema.parse('hello')).toBe('hello');
			expect(optionalSchema.parse(undefined)).toBeUndefined();
			expect(() => optionalSchema.parse(null)).toThrow(validator.ValidationError);
		});

		it('should handle nullable strings', () => {
			const nullableSchema = schema.nullable();
			expect(nullableSchema.parse('hello')).toBe('hello');
			expect(nullableSchema.parse(null)).toBeNull();
			expect(() => nullableSchema.parse(undefined)).toThrow(validator.ValidationError);
		});

		it('should support refinements', () => {
			const emailSchema = schema.refine((s) => s.includes('@'), 'Invalid email format');
			expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
			expect(() => emailSchema.parse('invalid')).toThrow(validator.ValidationError);
		});
	});

	describe('number()', () => {
		const schema = validator.number();

		it('should accept valid numbers', () => {
			expect(schema.parse(123)).toBe(123);
			expect(schema.parse(0)).toBe(0);
			expect(schema.parse(-123.45)).toBe(-123.45);
		});

		it('should reject NaN', () => {
			expect(() => schema.parse(NaN)).toThrow(validator.ValidationError);
		});

		it('should reject non-numbers', () => {
			expect(() => schema.parse('123')).toThrow(validator.ValidationError);
			expect(() => schema.parse(null)).toThrow(validator.ValidationError);
			expect(() => schema.parse(undefined)).toThrow(validator.ValidationError);
		});
	});

	describe('object()', () => {
		const userSchema = validator.object({
			id: validator.number(),
			name: validator.string(),
			email: validator.string().optional(),
			settings: validator.object({
				theme: validator.string(),
				notifications: validator.boolean(),
			}),
		});

		it('should accept valid objects', () => {
			const validUser = {
				id: 1,
				name: 'John',
				settings: {
					theme: 'dark',
					notifications: true,
				},
			};
			expect(userSchema.parse(validUser)).toEqual(validUser);
		});

		it('should strip unknown properties', () => {
			const input = {
				id: 1,
				name: 'John',
				unknown: 'field',
				settings: {
					theme: 'dark',
					notifications: true,
					extra: 'value',
				},
			};
			const expected = {
				id: 1,
				name: 'John',
				settings: {
					theme: 'dark',
					notifications: true,
				},
			};
			expect(userSchema.parse(input)).toEqual(expected);
		});

		it('should handle optional fields', () => {
			const valid = {
				id: 1,
				name: 'John',
				settings: {
					theme: 'dark',
					notifications: true,
				},
			};
			expect(userSchema.parse(valid)).toEqual(valid);
		});

		it('should reject invalid types', () => {
			expect(() =>
				userSchema.parse({
					id: '1', // should be number
					name: 'John',
					settings: {
						theme: 'dark',
						notifications: true,
					},
				})
			).toThrow(validator.ValidationError);
		});
	});

	describe('array()', () => {
		const numberArraySchema = validator.array(validator.number());

		it('should accept valid arrays', () => {
			expect(numberArraySchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
			expect(numberArraySchema.parse([])).toEqual([]);
		});

		it('should reject non-arrays', () => {
			expect(() => numberArraySchema.parse(123)).toThrow(validator.ValidationError);
			expect(() => numberArraySchema.parse({})).toThrow(validator.ValidationError);
		});

		it('should reject arrays with invalid elements', () => {
			expect(() => numberArraySchema.parse([1, '2', 3])).toThrow(validator.ValidationError);
		});
	});

	describe('safeParse()', () => {
		const schema = validator.object({
			name: validator.string(),
			age: validator.number(),
		});

		it('should return success result for valid data', () => {
			const result = schema.safeParse({ name: 'John', age: 30 });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ name: 'John', age: 30 });
			}
		});

		it('should return error result for invalid data', () => {
			const result = schema.safeParse({ name: 'John', age: '30' });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeInstanceOf(validator.ValidationError);
			}
		});
	});
	describe('enum()', () => {
		enum Status {
			Active = 'active',
			Inactive = 'inactive',
			Pending = 'pending',
		}

		const schema = validator.enum(Status);

		it('should accept valid enum values', () => {
			expect(schema.parse('active')).toBe('active');
			expect(schema.parse('inactive')).toBe('inactive');
			expect(schema.parse('pending')).toBe('pending');
		});

		it('should reject invalid values', () => {
			expect(() => schema.parse('unknown')).toThrow(validator.ValidationError);
			expect(() => schema.parse(123)).toThrow(validator.ValidationError);
			expect(() => schema.parse(null)).toThrow(validator.ValidationError);
		});

        enum User {
            Active,
            Removed
        }

        const userSchema = validator.enum(User);

        it('should accept valid User enum values', () => {
            expect(userSchema.parse(0)).toBe(0);
            expect(userSchema.parse(1)).toBe(1);
        });


		it('should reject invalid User values', () => {
			expect(() => schema.parse(2)).toThrow(validator.ValidationError);
			expect(() => schema.parse(123)).toThrow(validator.ValidationError);
			expect(() => schema.parse(null)).toThrow(validator.ValidationError);
		});
	});
});

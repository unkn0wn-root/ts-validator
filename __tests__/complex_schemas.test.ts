import { validator } from '../index';

describe('Complex Schema Scenarios', () => {
	describe('Nested Objects with Arrays', () => {
		const schema = validator.object({
			users: validator.array(
				validator.object({
					id: validator.number(),
					tags: validator.array(validator.string()),
				})
			),
			metadata: validator
				.object({
					lastUpdated: validator.date(),
					version: validator.number(),
				})
				.optional(),
		});

		it('should validate complex nested structures', () => {
			const data = {
				users: [
					{ id: 1, tags: ['admin', 'user'] },
					{ id: 2, tags: ['user'] },
				],
				metadata: {
					lastUpdated: new Date('2024-01-01'),
					version: 1,
				},
			};
			expect(schema.parse(data)).toEqual(data);
		});
	});

	describe('Union Types', () => {
		const schema = validator.object({
			id: validator.union([validator.string(), validator.number()]),
			status: validator.union([validator.literal('active'), validator.literal('inactive'), validator.literal('pending')]),
		});

		it('should accept valid union values', () => {
			expect(schema.parse({ id: '123', status: 'active' })).toEqual({ id: '123', status: 'active' });
			expect(schema.parse({ id: 123, status: 'inactive' })).toEqual({ id: 123, status: 'inactive' });
		});

		it('should reject invalid union values', () => {
			expect(() => schema.parse({ id: true, status: 'active' })).toThrow(validator.ValidationError);
			expect(() => schema.parse({ id: '123', status: 'unknown' })).toThrow(validator.ValidationError);
		});
	});

	describe('Refinements', () => {
		const userSchema = validator.object({
			username: validator.string().refine((s) => s.length >= 3, 'Username must be at least 3 characters'),
			age: validator.number().refine((n) => n >= 18, 'Must be 18 or older'),
			email: validator.string().refine((s) => s.includes('@'), 'Invalid email format'),
		});

		it('should pass valid refined data', () => {
			const validUser = {
				username: 'john_doe',
				age: 25,
				email: 'john@example.com',
			};
			expect(userSchema.parse(validUser)).toEqual(validUser);
		});

		it('should fail refinement checks with appropriate error messages', () => {
			let result = userSchema.safeParse({
				username: 'jo',
				age: 25,
				email: 'john@example.com',
			});

			expect(result.success).toBe(false);

			if (!result.success) {
				expect(result.error.issues).toContainEqual(
					expect.objectContaining({
						message: 'Username must be at least 3 characters',
						path: ['username'],
					})
				);
			}

			result = userSchema.safeParse({
				username: 'john',
				age: 16,
				email: 'john@example.com',
			});

			expect(result.success).toBe(false);

			if (!result.success) {
				expect(result.error.issues).toContainEqual(
					expect.objectContaining({
						message: 'Must be 18 or older',
						path: ['age'],
					})
				);
			}

			result = userSchema.safeParse({
				username: 'john',
				age: 25,
				email: 'invalid-email',
			});

			expect(result.success).toBe(false);

			if (!result.success) {
				expect(result.error.issues).toContainEqual(
					expect.objectContaining({
						message: 'Invalid email format',
						path: ['email'],
					})
				);
			}
		});
	});
});

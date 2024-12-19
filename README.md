# TypeScript Validator

A lightweight, type-safe runtime validation library for TypeScript.

## Features

- Full TypeScript support with type inference
- Runtime validation
- Composable schemas
- Automatic removal of unknown properties
- Zero dependencies
- Small bundle size

## Installation

```bash
npm install @unkn0wn-root/ts-validator
# or
yarn add @unkn0wn-root/ts-validator
```

## Usage

```typescript
import { validator } from '@unkn0wn-root/ts-validator';

enum Status {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending'
}

// Define your schema
const userSchema = validator.object({
  id: validator.number(),
  username: validator.string().refine((s) => s.length >= 3, 'Username must be at least 3 characters'), // add custom validation
  name: validator.string(),
  email: validator.string().optional(),
  status: validator.enum(Status),
  metadata: validator.object({
    lastLogin: validator.date().nullable(),
    preferences: validator.object({
      theme: validator.string()
    }).optional()
  })
});

// Type inference
type User = typeof userSchema._type;

// Parse data (throws on invalid data)
try {
  const user = userSchema.parse({
    id: 123,
    username: "jobo"
    name: "John",
    email: "john@example.com",
    status: Status.Active, // Must be one of "active", "inactive", or "pending"
    metadata: {
      lastLogin: new Date(),
      preferences: {
        theme: "dark"
      }
    }
  });
  console.log("Valid user:", user);
} catch (error) {
  if (error instanceof validator.ValidationError) {
    console.error("Validation errors:", error.issues);
  }
}

// Safe parsing (returns result object)
const result = userSchema.safeParse(data);
if (result.success) {
  console.log("Valid data:", result.data);
} else {
  console.error("Validation errors:", result.error.issues);
}
```

## API Reference

### Basic Types

- `validator.string()`
- `validator.number()`
- `validator.boolean()`
- `validator.date()`

### Complex Types

- `validator.array(schema)`
- `validator.object(shape)`
- `validator.literal(value)`
- `validator.union(schemas)`
- `validator.enum(EnumType)`

### Modifiers

- `.optional()` - Makes a field optional
- `.nullable()` - Allows null values
- `.refine(check, message)` - Adds custom validation logic

## Error Handling

The library throws `ValidationError` instances which contain detailed information about validation failures:

```typescript
try {
  const data = schema.parse(invalidData);
} catch (error) {
  if (error instanceof validator.ValidationError) {
    error.issues.forEach(issue => {
      console.log(`Error at ${issue.path.join('.')}: ${issue.message}`);
    });
  }
}
```

## License

MIT

export const DIRECT_ADDRESS = createToken({
  name: 'DIRECT_ADDRESS',
  pattern: /\%[IMQ][XBW][\d\.]+/,
});

export const ENUM_REFERENCE = createToken({
  name: 'ENUM_REFERENCE',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*#[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const NUMBER = createToken({
  name: 'NUMBER',
  pattern: /[0-9]+(\.[0-9]+)?/,
});

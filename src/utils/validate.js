const isPositiveNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

/** Returns a copy of `source` without the listed keys. */
const omit = (source, keys) =>
  Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));

module.exports = { isPositiveNumber, isPositiveInteger, omit };

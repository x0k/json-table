export const sum = (a: number, b: number): number => a + b
export const subtract = (a: number, b: number): number => a - b
export const multiply = (a: number, b: number): number => a * b
export const divide = (a: number, b: number): number => a / b

export const max = (a: number, b: number): number => (a > b ? a : b)
export const min = (a: number, b: number): number => (a < b ? a : b)

export const gcd = (a: number, b: number): number => (a ? gcd(b % a, a) : b)
export const lcm = (a: number, b: number): number => (a * b) / gcd(a, b)

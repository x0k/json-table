declare const brand: unique symbol

export type Brand<Name extends string, Base = string> = Base & { [brand]: Name }

export enum JSONParseStatus {
  Ok = 'ok',
  Error = 'error',
}

export type JSONParseResult<T, E> =
  | {
      status: JSONParseStatus.Ok
      data: T
    }
  | {
      status: JSONParseStatus.Error
      error: E
    }

export function jsonTryParse<T = unknown, E = Error>(
  json: string
): JSONParseResult<T, E> {
  try {
    return {
      status: JSONParseStatus.Ok,
      data: JSON.parse(json),
    }
  } catch (error) {
    return {
      status: JSONParseStatus.Error,
      error: error as E,
    }
  }
}

export function jsonSafeParse<T>(json: string, defaultValue: T): T {
  const result = jsonTryParse<T>(json)
  return result.status === JSONParseStatus.Ok ? result.data : defaultValue
}

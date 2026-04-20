export const EXIT_SUCCESS = 0;
export const EXIT_NOT_FOUND = 1;
export const EXIT_USAGE = 2;
export const EXIT_RATE_LIMITED = 3;
export const EXIT_NETWORK = 4;

export type ExitCode =
  | typeof EXIT_SUCCESS
  | typeof EXIT_NOT_FOUND
  | typeof EXIT_USAGE
  | typeof EXIT_RATE_LIMITED
  | typeof EXIT_NETWORK;

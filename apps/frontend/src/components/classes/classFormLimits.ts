export const CLASS_NAME_MAX_LENGTH = 50;
export const CLASS_DESCRIPTION_MAX_LENGTH = 500;

export function limitClassName(value: string) {
  return value.slice(0, CLASS_NAME_MAX_LENGTH);
}

export function limitClassDescription(value: string) {
  return value.slice(0, CLASS_DESCRIPTION_MAX_LENGTH);
}

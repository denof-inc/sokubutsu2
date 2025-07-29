import { jest } from '@jest/globals';

export const schedule = jest.fn();
export const validate = jest.fn(() => true);
export const getTasks = jest.fn(() => new Map());

export default {
  schedule,
  validate,
  getTasks,
};

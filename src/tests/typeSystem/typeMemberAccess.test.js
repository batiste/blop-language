// Tests for type member access syntax: State.dogPage and State['dogPage']
import { describe, test } from 'vitest';
import { expectCompiles, expectCompilationError } from '../testHelpers.js';

describe('type member access (dot notation)', () => {
  test('State.key resolves to the nested object type', () => {
    expectCompiles(`
      type State = {
        counter: number
      }
      type Props = {
        value: State.counter
      }
      p: Props = { value: 42 }
    `);
  });

  test('State.nestedObject resolves to its object type', () => {
    expectCompiles(`
      type State = {
        dogPage: { score: number, attempt: number }
      }
      type DogGameProps = {
        page: State.dogPage,
        state: State
      }
      props: DogGameProps = {
        page: { score: 0, attempt: 0 },
        state: { dogPage: { score: 0, attempt: 0 } }
      }
    `);
  });

  test('function parameter typed with State.key', () => {
    expectCompiles(`
      type State = {
        dogPage: { score: number, attempt: number }
      }
      def handlePage(page: State.dogPage): number {
        return page.score
      }
    `);
  });

  test('type error: wrong type assigned to State.key-typed parameter', () => {
    expectCompilationError(`
      type State = {
        counter: number
      }
      type Props = {
        value: State.counter
      }
      p: Props = { value: 'not-a-number' }
    `, /type/i);
  });
});

describe('type member access (bracket string notation)', () => {
  test("State['key'] resolves to the nested object type", () => {
    expectCompiles(`
      type State = {
        counter: number
      }
      type Props = {
        value: State['counter']
      }
      p: Props = { value: 42 }
    `);
  });

  test("State['nestedObject'] resolves to its object type", () => {
    expectCompiles(`
      type State = {
        dogPage: { score: number, attempt: number }
      }
      type DogGameProps = {
        page: State['dogPage'],
        state: State
      }
      props: DogGameProps = {
        page: { score: 0, attempt: 0 },
        state: { dogPage: { score: 0, attempt: 0 } }
      }
    `);
  });
});

describe('type member access in the motivating use case', () => {
  test('DogPage full example compiles', () => {
    expectCompiles(`
      type State = {
        dogPage: {
          score: number,
          attempt: number,
          success: number,
          choice?: { url: string, breed: string, image: string }
        }
      }
      type DogGameProps = {
        page: State.dogPage,
        state: State
      }
      def renderGame(props: DogGameProps): number {
        return props.page.score
      }
    `);
  });
});

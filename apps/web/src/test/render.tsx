import { type ReactElement } from 'react';
import { render as testingLibraryRender } from '@testing-library/react';

export function render(ui: ReactElement) {
  return testingLibraryRender(ui);
}

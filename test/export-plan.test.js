import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExportPlan } from '../src/export-plan.js';
import { newProject, addTake, splitSegment, removeSegment } from '../src/edit-project.js';
test('export uses edited source intervals, not the complete original recording', () => {
  const project = removeSegment(splitSegment(addTake(newProject(), { id: 'a', duration: 12 }), 0, 5), 0);
  assert.deepEqual(buildExportPlan(project), [{ takeId: 'a', start: 5, end: 12, duration: 7 }]);
});
test('export rejects missing source media and empty timelines', () => {
  assert.throws(() => buildExportPlan(newProject()));
  assert.throws(() => buildExportPlan({ takes: [], segments: [{ takeId: 'missing', in: 0, out: 2 }] }));
});

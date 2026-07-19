import { describe, expect, it } from 'vitest';
import { GROUP_LETTERS, groupLabel, groupName } from './labels';

/** Označovanie skupín pri veľkých turnajoch — 460 hráčov znamená 115 skupín. */
describe('označovanie skupín', () => {
  it('prvých 25 sú samostatné písmená bez W', () => {
    expect(groupLabel(0)).toBe('A');
    expect(groupLabel(1)).toBe('B');
    expect(groupLabel(21)).toBe('V');
    expect(groupLabel(22)).toBe('X');   // W sa preskakuje
    expect(groupLabel(24)).toBe('Z');
    expect(GROUP_LETTERS).not.toContain('W');
    expect(GROUP_LETTERS).toHaveLength(25);
  });

  it('po Z pokračuje A1 až Z1', () => {
    expect(groupLabel(25)).toBe('A1');
    expect(groupLabel(26)).toBe('B1');
    expect(groupLabel(49)).toBe('Z1');
  });

  it('po Z1 pokračuje AA1 až AZ1', () => {
    expect(groupLabel(50)).toBe('AA1');
    expect(groupLabel(51)).toBe('AB1');
    expect(groupLabel(74)).toBe('AZ1');
  });

  it('potom AA2 až AZ2 a ďalej', () => {
    expect(groupLabel(75)).toBe('AA2');
    expect(groupLabel(99)).toBe('AZ2');
    expect(groupLabel(100)).toBe('AA3');
    expect(groupLabel(124)).toBe('AZ3');
    expect(groupLabel(125)).toBe('AA4');
  });

  it('nikdy nevznikne iný znak než písmeno alebo číslica', () => {
    for (let i = 0; i < 500; i++) expect(groupLabel(i)).toMatch(/^[A-Z]+[0-9]*$/);
  });

  it('žiadne dve skupiny nemajú rovnaké označenie', () => {
    const vsetky = Array.from({ length: 500 }, (_, i) => groupLabel(i));
    expect(new Set(vsetky).size).toBe(500);
  });

  it('115 skupín pre 460 hráčov po štyroch má zmysluplné označenia', () => {
    expect(groupName(0)).toBe('Skupina A');
    expect(groupName(114)).toBe('Skupina AO3');
    expect(groupLabel(114)).toMatch(/^[A-Z]+[0-9]*$/);
  });
});

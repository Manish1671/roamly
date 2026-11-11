import { roleHasPermission } from './trip-permissions';

describe('trip permissions matrix', () => {
  it('allows owners to invite and archive', () => {
    expect(roleHasPermission('OWNER', 'INVITE')).toBe(true);
    expect(roleHasPermission('OWNER', 'ARCHIVE')).toBe(true);
    expect(roleHasPermission('EDITOR', 'INVITE')).toBe(false);
    expect(roleHasPermission('VIEWER', 'EDIT_TRIP')).toBe(false);
  });

  it('allows viewers to vote but not manage polls', () => {
    expect(roleHasPermission('VIEWER', 'VOTE_ON_POLL')).toBe(true);
    expect(roleHasPermission('VIEWER', 'MANAGE_POLL')).toBe(false);
  });

  it('allows editors to edit but not manage membership', () => {
    expect(roleHasPermission('EDITOR', 'EDIT_TRIP')).toBe(true);
    expect(roleHasPermission('EDITOR', 'INVITE')).toBe(false);
    expect(roleHasPermission('EDITOR', 'CHANGE_ROLES')).toBe(false);
    expect(roleHasPermission('EDITOR', 'REMOVE_MEMBER')).toBe(false);
    expect(roleHasPermission('EDITOR', 'ARCHIVE')).toBe(false);
  });
});

/**
 * Mirador action type constants.
 * These mirror the values from Mirador core so the plugin can dispatch
 * actions without importing directly from the Mirador source tree.
 */
const ActionTypes = {
  ADD_COMPANION_WINDOW: 'mirador/ADD_COMPANION_WINDOW',
  REMOVE_COMPANION_WINDOW: 'mirador/REMOVE_COMPANION_WINDOW',
  UPDATE_COMPANION_WINDOW: 'mirador/UPDATE_COMPANION_WINDOW',
  SET_CANVAS: 'mirador/SET_CANVAS',
  UPDATE_WINDOW: 'mirador/UPDATE_WINDOW',
  ADD_OVERLAY: 'mirador/ADD_OVERLAY',
  REMOVE_OVERLAY: 'mirador/REMOVE_OVERLAY',
  CLEAR_OVERLAYS: 'mirador/CLEAR_OVERLAYS',
};

export default ActionTypes;

import { ChatTopBarButton } from './components/ChatTopBarButton';
import { ChatCompanionWindow } from './ChatCompanionWindowContainer';
import ActionTypes from '../../mirador/src/state/actions/action-types';
import { v4 as uuid } from 'uuid';

/**
 * Mirador 4 plugin configuration for AI chat assistant
 * 
 * This plugin adds:
 * 1. A chat button in the window top bar (right side)
 * 2. A companion window for the chat interface (positioned on the right side)
 */
export const miradorQuestionPlugin = [
  // Add chat button to the window top bar (right side)
  {
    target: 'WindowTopBarPluginArea',
    mode: 'add',
    name: 'ChatTopBarButton',
    component: ChatTopBarButton,
    mapStateToProps: (state, { windowId }) => {
      // Find existing chat companion windows for this window
      const companionWindows = state.companionWindows || {};
      const existingChatWindow = Object.keys(companionWindows).find(
        cwId => {
          const cw = companionWindows[cwId];
          return cw.windowId === windowId && cw.content === 'chat' && cw.position === 'right';
        }
      );
      
      return {
        existingWindowId: existingChatWindow || null,
      };
    },
    mapDispatchToProps: (dispatch, { windowId }) => ({
      addCompanionWindow: (content) => {
        const id = `cw-${uuid()}`;
        return dispatch({
          id,
          payload: {
            content,
            position: 'right',
            id,
            windowId,
          },
          type: ActionTypes.ADD_COMPANION_WINDOW,
          windowId,
        });
      },
      removeCompanionWindow: (id) => {
        return dispatch({
          id,
          type: ActionTypes.REMOVE_COMPANION_WINDOW,
          windowId,
        });
      },
    }),
  },
  // Register the chat companion window
    {
        name: 'ChatCompanionWindow',
        companionWindowKey: 'chat',
        component: ChatCompanionWindow,
        mapStateToProps: (state, { windowId, id }) => {
            const window = state.windows?.[windowId];
            const manifestId = window?.manifestId;

            return {
                id,
                windowId,
                manifestId,
                state,
            };
        },
        mapDispatchToProps: (dispatch, { windowId }) => ({
            setCanvas: (canvasIndex) =>
                dispatch({
                    type: ActionTypes.SET_CANVAS,
                    windowId,
                    canvasIndex,
                }),
            updateWindow: (updates) =>
                dispatch({
                    type: ActionTypes.UPDATE_WINDOW,
                    windowId,
                    payload: updates,
                }),
            addOverlay: (overlay) =>
                dispatch({
                    type: ActionTypes.ADD_OVERLAY,
                    windowId,
                    payload: overlay,
                }),
            removeOverlay: (overlayId) =>
                dispatch({
                    type: ActionTypes.REMOVE_OVERLAY,
                    windowId,
                    overlayId,
                }),
            clearOverlays: () =>
                dispatch({
                    type: ActionTypes.CLEAR_OVERLAYS,
                    windowId,
                }),
        }),
    },

];

export default miradorQuestionPlugin;

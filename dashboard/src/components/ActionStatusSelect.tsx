import { useSetRecoilState } from 'recoil';
import { DONE, TODO, CANCEL, prepareActionForEncryption, actionsState } from '../recoil/actions';
import API from '../services/api';

export default function ActionStatusSelect({ action }: { action: any }) {
  const setActions = useSetRecoilState(actionsState);
  return (
    <select
      className="tw-appearance-none tw-rounded-full tw-border-none tw-bg-red-600 tw-text-center tw-text-[10px] tw-font-bold tw-text-white tw-outline-none"
      value={action.status}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onChange={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const actionResponse = await API.put({
          path: `/action/${action._id}`,
          body: prepareActionForEncryption({ ...action, status: e.target.value }),
        });
        if (!actionResponse.ok) return;
        const newAction = actionResponse.decryptedData;
        setActions((actions: any) =>
          actions.map((a: any) => {
            if (a._id === newAction._id) return newAction;
            return a;
          })
        );
      }}>
      <option value={TODO}>{TODO}</option>
      <option value={DONE}>{DONE}</option>
      <option value={CANCEL}>{CANCEL}</option>
    </select>
  );
}

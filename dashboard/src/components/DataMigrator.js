import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { mappedIdsToLabels, prepareActionForEncryption } from '../recoil/actions';
import { organisationState, userState } from '../recoil/auth';
import { usePreparePersonForEncryption } from '../recoil/persons';
import { prepareReportForEncryption } from '../recoil/reports';
import API, { encryptItem } from '../services/api';
import { dayjsInstance } from '../services/date';
import { loadingTextState } from './DataLoader';
import { looseUuidRegex } from '../utils';
import { prepareCommentForEncryption } from '../recoil/comments';
import { prepareGroupForEncryption } from '../recoil/groups';
import { capture } from '../services/sentry';

const LOADING_TEXT = 'Mise à jour des données de votre organisation…';

/*eslint no-unused-vars: "off"*/
export default function useDataMigrator() {
  const setLoadingText = useSetRecoilState(loadingTextState);
  const user = useRecoilValue(userState);
  const [organisation, setOrganisation] = useRecoilState(organisationState);

  const organisationId = organisation?._id;

  const preparePersonForEncryption = usePreparePersonForEncryption();

  return {
    // One "if" for each migration.
    // `migrationLastUpdateAt` should be set after each migration and send in every PUT/POST/PATCH request to server.
    migrateData: async () => {
      let migrationLastUpdateAt = organisation.migrationLastUpdateAt;
      /*
      // Example of migration:
      if (!organisation.migrations?.includes('migration-name')) {
        setLoadingText(LOADING_TEXT);
        const somethingRes = await API.get({
          path: '/something-to-update',
          query: { organisation: organisationId, after: 0, withDeleted: false },
        }).then((res) => res.decryptedData || []);

        const somethingToUpdate = somethingRes.map((e) => {
          // do something
        });

        const encryptedThingsToUpdate = await Promise.all(somethingToUpdate.map(prepareForEncryption).map(encryptItem));
        const response = await API.put({
          path: `/migration/migration-name`,
          body: { thingsToUpdate: encryptedThingsToUpdate, thingsIdsToDestroy: [] },
          query: { migrationLastUpdateAt },
        });
        if (response.ok) {
          setOrganisation(response.organisation);
          migrationLastUpdateAt = response.organisation.migrationLastUpdateAt;
        }
      }
      // End of example of migration.
      */

      if (!organisation.migrations?.includes('integrate-comments-in-actions-history')) {
        setLoadingText(LOADING_TEXT);
        const comments = await API.get({
          path: '/comment',
          query: { organisation: organisationId, after: 0, withDeleted: false },
        }).then((res) => res.decryptedData || []);
        const actions = await API.get({
          path: '/action',
          query: { organisation: organisationId, after: 0, withDeleted: false },
        }).then((res) => res.decryptedData || []);

        const actionsPerId = {};
        for (const action of actions) {
          actionsPerId[action._id] = action;
        }
        const actionsToUpdate = {};
        const commentIdsToDelete = [];

        for (const comment of comments) {
          if (!comment.action) continue;
          if (!comment.comment.includes("a changé le status de l'action: ")) continue;
          const action = actionsToUpdate[comment.action] ?? actionsPerId[comment.action];
          if (!action) {
            commentIdsToDelete.push(comment._id);
            continue;
          }
          if (!action.history) action.history = [];
          const statusName = comment.comment.split("a changé le status de l'action: ")[1];
          const statusId = mappedIdsToLabels.find((e) => e.name === statusName)?._id;
          action.history.push({
            user: comment.user,
            date: comment.createdAt,
            data: {
              status: { oldValue: '', newValue: statusId },
            },
          });
          actionsToUpdate[comment.action] = action;
          commentIdsToDelete.push(comment._id);
        }

        const encryptedActionsToUpdate = await Promise.all(
          Object.values(actionsToUpdate)
            .map((action) => prepareActionForEncryption(action, { checkRequiredFields: false }))
            .map(encryptItem)
        );

        const response = await API.put({
          path: `/migration/integrate-comments-in-actions-history`,
          body: { commentIdsToDelete, actionsToUpdate: encryptedActionsToUpdate },
          query: { migrationLastUpdateAt },
        });
        if (response.ok) {
          setOrganisation(response.organisation);
          migrationLastUpdateAt = response.organisation.migrationLastUpdateAt;
        }
      }

      if (!organisation.migrations?.includes('re-evaluate-comments-in-persons-history')) {
        setLoadingText(LOADING_TEXT);
        const comments = await API.get({
          path: '/comment',
          query: { organisation: organisationId, after: 0, withDeleted: false },
        }).then((res) => res.decryptedData || []);

        const persons = await API.get({
          path: '/person',
          query: { organisation: organisationId, after: 0, withDeleted: false },
        }).then((res) => res.decryptedData || []);

        const personHistoryComments = comments.filter((c) => {
          if (!c.comment.includes('Changement de')) return false;
          if (!c.comment.includes('Avant:')) return false;
          if (!c.comment.includes('Désormais:')) return false;
          return true;
        });

        const earlisestComment = personHistoryComments[personHistoryComments.length - 1]?.createdAt?.split('T')[0];
        const latestComment = personHistoryComments[0]?.createdAt?.split('T')[0];
        capture(
          `ECOMHISTFORCSV: ${organisation._id},${comments.length},${personHistoryComments.length},${persons.length},${earlisestComment},${latestComment}`,
          {
            extra: {
              organisationId,
              'total-comments': comments.length,
              'total-history-comments': personHistoryComments.length,
              'total-persons': persons.length,
              'earliest-comment': earlisestComment,
              'latest-comment': latestComment,
            },
          }
        );

        const response = await API.put({
          path: `/migration/evaluate-comments-in-persons-history`,
          query: { migrationLastUpdateAt },
        });
        if (response.ok) {
          setOrganisation(response.organisation);
          migrationLastUpdateAt = response.organisation.migrationLastUpdateAt;
        }
      }
    },
  };
}

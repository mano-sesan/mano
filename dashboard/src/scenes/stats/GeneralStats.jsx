import { Block } from "./Blocks";
import Filters from "../../components/Filters";
import { organisationState } from "../../atoms/auth";
import { useAtomValue } from "jotai";

const GeneralStats = ({
  personTypeCounts,
  personsCreated,
  personsUpdated,
  rencontres,
  passages,
  actions,
  countFollowedWithActions,
  personsUpdatedWithActions,
  filterBase,
  filterPersons,
  setFilterPersons,
  isStatsV2,
}) => {
  const organisation = useAtomValue(organisationState);
  return (
    <>
      {!isStatsV2 && <h3 className="tw-my-5 tw-text-xl">Statistiques générales</h3>}
      {!isStatsV2 && (
        <div className="tw-flex tw-basis-full tw-items-center">
          <Filters title="Filtrer par personnes suivies:" base={filterBase} filters={filterPersons} onChange={setFilterPersons} />
        </div>
      )}
      <div className="tw-grid tw-grid-cols-2 tw-gap-4 tw-my-8">
        {isStatsV2 ? (
          <>
            <Block
              data={personTypeCounts?.all}
              title="Toutes les personnes"
              help="Toutes les personnes assignées à au moins une des équipes sélectionnées pendant la période sélectionnée, qu'il y ait eu une interaction ou non."
            />
            <Block
              data={personTypeCounts?.modified}
              title="Personnes mises à jour"
              help="Personnes assignées à au moins une des équipes sélectionnées pendant la période sélectionnée, pour lesquelles il y a eu au moins une interaction durant la période, quel que soit leur statut au moment de la modification, y compris pendant qu'elles sont en dehors de la file active ou en dehors des équipes sélectionnées."
            />
            <Block
              data={personTypeCounts?.followed}
              title="Personnes suivies"
              help="Personnes assignées à au moins une des équipes sélectionnées pendant la période sélectionnée, pour lesquelles il y a eu au moins une interaction durant la période, en ne comptant que les interactions réalisées lorsque la personne était présente dans une des équipes sélectionnées et non sortie de file active."
            />
            <Block
              data={personTypeCounts?.created}
              title="Nouvelles personnes"
              help="Personnes qui ont rejoint une des équipes sélectionnées pour la première fois ou dont le suivi a commencé durant la période sélectionnée."
            />
          </>
        ) : (
          <>
            <Block
              data={personsCreated}
              title="Nombre de personnes créées"
              help={`Nombre de personnes dont la date 'Suivi(e) depuis' se situe dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des personnes.`}
            />
            <Block
              data={personsUpdated}
              title="Nombre de personnes suivies"
              help={`Nombre de personnes pour lesquelles il s'est passé quelque chose durant la période sélectionnée:\n\ncréation, modification, commentaire, action, rencontre, passage, lieu fréquenté, consultation, traitement.\n\nSi aucune période n'est définie, on considère l'ensemble des personnes.`}
            />
          </>
        )}
        <Block
          data={isStatsV2 ? countFollowedWithActions : personsUpdatedWithActions}
          title="Personnes suivies concernées par au moins une action"
          help={`Nombre de personnes suivies par les équipes sélectionnées <b>pour lesquelles au moins une action a été créée</b> dans la période définie.\n\nSi aucune période n'est définie, on considère la totalité des actions par rapport à la totalité des personnes.`}
        />
        <Block
          data={actions}
          title="Nombre d'actions"
          help={`Nombre d'actions enregistrées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des actions.`}
        />
        {organisation.rencontresEnabled ? (
          <Block
            data={rencontres.length}
            title="Nombre de rencontres"
            help={`Nombre de rencontres enregistrées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des rencontres.`}
          />
        ) : null}
        {organisation.passagesEnabled ? (
          <Block
            data={passages.length}
            title="Nombre de passages"
            help={`Nombre de passages enregistrés dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des passages.`}
          />
        ) : null}
      </div>
    </>
  );
};

export default GeneralStats;

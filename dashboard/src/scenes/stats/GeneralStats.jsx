import { Block } from "./Blocks";
import Filters from "../../components/Filters";
import { organisationState } from "../../recoil/auth";
import { useRecoilValue } from "recoil";

const GeneralStats = ({
  personsCreated,
  personsUpdated,
  rencontres,
  passages,
  actions,
  observations,
  personsUpdatedWithActions,
  filterBase,
  filterPersons,
  setFilterPersons,
}) => {
  const organisation = useRecoilValue(organisationState);
  return (
    <>
      <h3 className="tw-my-5 tw-text-xl">Statistiques générales</h3>
      <div className="tw-flex tw-basis-full tw-items-center">
        <Filters title="Filtrer par personnes suivies:" base={filterBase} filters={filterPersons} onChange={setFilterPersons} />
      </div>
      <div className="tw-grid tw-grid-cols-2 xl:tw-grid-cols-3 2xl:tw-grid-cols-4 tw-gap-4 tw-my-8">
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
        <Block
          data={personsUpdatedWithActions}
          title="Nombre de personnes suivies concernées par au moins une action"
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
        {organisation.territoriesEnabled ? (
          <Block
            data={observations.length}
            title="Nombre d'observations"
            help={`Nombre d'observations enregistrées dans la période définie.\n\nLes observations ne sont pas liées à une personne, mais à un territoire, le filtre sélectionné est donc ignoré.`}
          />
        ) : null}
      </div>
    </>
  );
};

export default GeneralStats;

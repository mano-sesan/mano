import { useState } from "react";
import { useAtom } from "jotai";
import ButtonCustom from "../../components/ButtonCustom";
import { userState } from "../../recoil/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import OpenNewWindowIcon from "../../components/OpenNewWindowIcon";

const CGUs = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useAtom(userState);

  const onSigninValidated = async () => {
    setLoading(true);
    const cgusAccepted = Date.now();
    const [error] = await tryFetchExpectOk(async () => API.put({ path: "/user", body: { cgusAccepted } }));
    if (error) return;
    setUser({ ...user, cgusAccepted });
  };

  return (
    <div
      className="tw-flex tw-w-full tw-flex-col tw-items-center tw-overflow-y-auto tw-overflow-x-hidden tw-rounded-lg tw-bg-white tw-py-20 tw-text-black"
      id="cgus"
    >
      <h1 className="tw-mb-4 tw-mt-20 tw-text-center tw-text-3xl tw-font-semibold tw-text-main">Conditions Générales d'Utilisation de Mano</h1>
      <small className="tw-block tw-text-center tw-font-medium tw-italic">
        Veuillez lire et accepter les Conditions Générales d'Utilisation de Mano avant de continuer
      </small>
      <main className="[&_b]:tw-font-weight-normal tw-mt-20 tw-w-full tw-max-w-prose tw-px-5 [&_b]:tw-mt-20 [&_b]:tw-block">
        <p>
          Les présentes conditions générales d'utilisation (dites «&nbsp;CGU&nbsp;») fixent le cadre juridique de "Mano" et définissent les conditions
          d'accès et d'utilisation des Services par l'Utilisateur.
        </p>
        <p>
          L'outil MANO vise à soutenir les professionnels sociaux et médico-sociaux intervenant auprès de populations en grande précarité, en
          renforçant la qualité de l'accompagnement qu'ils proposent.
        </p>
        <p>
          L'outil se veut un système sécurisé et chiffré de bout en bout, développé en collaboration étroite avec ses utilisateurs, et pensé par et
          pour le terrain, afin de garantir la confidentialité des données et répondre au mieux aux besoins des professionnels sur le terrain.
        </p>
        <p>Le Service permet notamment, par l'intermédiaire d'une application mobile, de&nbsp;:</p>
        <ol className="tw-list-inside tw-list-disc">
          <li>
            Planifier des actions (soins, accompagnements, démarches, orientations) à réaliser en lien avec les besoins individuels des personnes
            rencontrées sans abri&nbsp;;
          </li>
          <li>
            Collecter et partager des informations relatives aux populations afin d'améliorer la qualité de l'accompagnement et des soins dispensés
            ainsi que la connaissance de l'usager et de sa situation médico-sociale&nbsp;;
          </li>
          <li>Mener à bien les démarches administratives relatives aux populations&nbsp;;</li>
          <li>Orienter au mieux et au plus proche les populations en fonction de leurs besoins.</li>
        </ol>
        <p>L'outil MANO est destiné&nbsp;:</p>
        <ol className="tw-list-inside tw-list-disc">
          <li>
            Aux organisations et structures sociales et médico-sociales diverses (Dispositifs d'aller-vers, lieux d'accueil, dispositifs de réduction
            des risques, SAMU Sociaux, EMSP, ACT…) dans lesquelles il apportera une plus-value dans l'accompagnement des personnes accompagnées&nbsp;;
          </li>
          <li>Aux professionnels médico-sociaux et sociaux intervenant dans ces structures.</li>
        </ol>
        <section className="tw-mt-10">
          <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Article 1 – Définitions</h2>
          <ol className="tw-list-inside tw-list-disc">
            <li>
              «&nbsp;L'Utilisateur&nbsp;» désigne tout professionnel social ou médico-social inscrit sur l'outil Mano, chargé d'accompagner au
              quotidien les usagers dans le cadre de son activité professionnelle.
            </li>
            <li>
              «&nbsp;L'Usager&nbsp;» désigne toute personne en situation de grande précarité bénéficiant d'un accompagnement de la part des
              utilisateurs dans un contexte social ou médico-social.
            </li>
            <li>
              «&nbsp;L'Administrateur&nbsp;» fait référence au responsable de l'organisation où l'outil est déployé, généralement un chef de service
              ou un directeur de service social ou médico-social.
            </li>
            <li>
              «&nbsp;L'Organisation&nbsp;» correspond à la personne morale responsable des actions réalisées via Mano et titulaire du compte «
              Administrateur&nbsp;».
            </li>
          </ol>
        </section>
        <section className="tw-mt-10">
          <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Article 2 - Champ d'application</h2>
          <p>L'inscription est gratuite et réservée aux structures sociales et médico-sociales intervenant auprès de publics en grande précarité.</p>
        </section>
        <section className="tw-mt-10">
          <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Article 3 – Objet</h2>
          <p>
            Mano a pour objectif d'améliorer l'accompagnement proposé par les organisations utilisatrices. L'outil est conçu pour améliorer
            l'organisation du travail quotidien des professionnels, tout en garantissant une mémoire collective de l'accompagnement proposé à
            l'échelle de la structure utilisatrice. Personnalisable, il s'adapte aux diverses modalités d'intervention et à la complexité propre à ces
            structures, prenant en compte à la fois la pluralité des spécificités des publics accompagnés et la diversité des moyens d'action
            mobilisés. Il facilite le partage d'informations entre les membres d'une même équipe autour d'une file active commune d'usagers,
            améliorant ainsi la coordination. De plus, il offre une vision statistique détaillée, permettant à l'organisation de mieux connaître son
            public, de générer facilement des rapports d'activité et de disposer de données utiles pour le plaidoyer. Enfin, l'outil intègre une
            fonctionnalité de stockage des documents nécessaires à l'accompagnement des usagers.
          </p>
        </section>
        <section className="tw-mt-10">
          <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Article 4 - Fonctionnalités</h2>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">4.1 Création des différents profils</h3>
          <h4 className="tw-mt-4 tw-mb-2 tw-text-main">A – Création du profil «&nbsp;Administrateur&nbsp;»</h4>
          <p>
            Lors de la création d'une «&nbsp;Organisation&nbsp;» dans l'outil Mano, l'équipe projet Mano désigne un «&nbsp;Administrateur&nbsp;»
            responsable au sein de la structure. Après la création de l'Organisation par l'équipe projet, l'Administrateur assume la gestion de
            l'Organisation, notamment en attribuant les accès aux utilisateurs et en configurant les paramètres de l'outil. Cette démarche est
            accompagnée par l'équipe projet pour faciliter sa mise en œuvre. Lors de sa première connexion, l'Administrateur définit une clé de
            chiffrement unique pour son Organisation. Cette clé, utilisée pour un chiffrement de bout en bout, assure la protection et la
            confidentialité des données relatives aux personnes accompagnées. Chaque Organisation dispose ainsi de son propre système de chiffrement,
            garantissant une sécurité renforcée des informations concernant les personnes en grande précarité.
          </p>
          <h4 className="tw-mt-4 tw-mb-2 tw-text-main">B – Création du profil «&nbsp;Utilisateur&nbsp;»</h4>
          <p>
            La création du profil est réalisée par un compte «&nbsp;Administrateur&nbsp;» et peut être attribuée à tout professionnel de son
            Organisation. Il s'agit de tout professionnel intervenant auprès des personnes accompagnées. En tant que personne physique, ce
            professionnel peut utiliser l'outil dans le but de soutenir et d'accompagner les usagers dans le cadre de ses activités.
          </p>
          <ol className="tw-list-inside tw-list-disc">
            <li>
              Le profil «&nbsp;normal&nbsp;»&nbsp;; l'Administrateur choisit si le profil normal est également un «&nbsp;professionnel de
              santé&nbsp;»&nbsp;;
            </li>
            <li>
              Le profil «&nbsp;restreint&nbsp;» est destiné aux professionnels qui interviennent auprès des usagers accompagnés mais ne doivent pas
              avoir accès aux données détaillées sur la situation personnelle de ces derniers. Ces profils bénéficient d'une vue limitée dans l'outil,
              leur permettant de contribuer à l'accompagnement sans accéder aux informations sensibles ou confidentielles. Ils ne peuvent pas être
              attribués à des professionnels de santé.
            </li>
            <li>
              Le profil «&nbsp;statistiques uniquement&nbsp;»&nbsp;; Ne permet d'accéder qu'aux données statistiques anonymisées et est notamment
              adressé aux directions des organisations n'intervenant pas directement auprès des personnes accompagnées.
            </li>
          </ol>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">4.2 Fonctionnalités du profil «&nbsp;Administrateur&nbsp;»</h3>
          <p>Le compte «&nbsp;Administrateur&nbsp;» permet d'accéder aux mêmes fonctionnalités que le profil «&nbsp;normal&nbsp;».</p>

          <p>Par ailleurs, le compte peut, notamment via l'onglet «&nbsp;Organisation&nbsp;»&nbsp;:</p>
          <ol className="tw-list-inside tw-list-disc">
            <li>Configurer «&nbsp;l'Organisation&nbsp;»&nbsp;;</li>
            <li>
              Ajouter et préciser les types de Services susceptibles d'être proposés par l'Organisation, facilitant ainsi un accès aux données
              strictement nécessaires&nbsp;;
            </li>
            <li>
              Personnaliser les champs des dossiers de personnes suivies, notamment eu égard aux informations sociales et médicales. Seuls les
              professionnels de santé ou des personnes habilitées au sein des structures utilisatrices peuvent partager et accéder à de telles
              informations&nbsp;;
            </li>
            <li>Créer, modifier et supprimer les champs personnalisés utilisés par les Utilisateurs&nbsp;;</li>
          </ol>

          <p>
            Par ailleurs, le compte ou profil «&nbsp;Organisation&nbsp;» organise les «&nbsp;Utilisateurs&nbsp;» et les inclut dans des
            «&nbsp;équipes&nbsp;» différentes. Il peut également avoir accès à l'ensemble des comptes créés par sa structure, ainsi qu'à tous les
            comptes rendus des Utilisateurs, peu importe l'équipe de l'utilisateur. Il peut également accéder aux Statistiques de l'organisation.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">4.3 Fonctionnalités du profil «&nbsp;Utilisateur&nbsp;»</h3>
          <p>
            Les utilisateurs peuvent créer des actions, qui leur permettent de planifier les activités à réaliser avec les personnes accompagnées. Ils
            ont également la possibilité de créer des transmissions écrites afin de partager des informations essentielles à l'accompagnement,
            directement sur le dossier des personnes suivies. En complément, ils peuvent renseigner les différents champs du dossier des usagers,
            ajouter les documents nécessaires à leur accompagnement, et mettre à jour les informations en continu. Lorsque les utilisateurs sont des
            professionnels de santé, ils peuvent renseigner des données spécifiques relatives aux consultations, l'équivalent des actions pour leur
            domaine d'intervention. Ces consultations, accessibles uniquement aux professionnels de santé, peuvent également être planifiées à
            l'avance, leur permettant d'organiser un accompagnement structuré et à long terme.
          </p>
          <p>
            En cas de mobilité sur le terrain, les utilisateurs peuvent collecter des données relatives aux zones où ils effectuent une veille active,
            notamment pour couvrir des territoires d'intervention spécifiques.
          </p>
          <p>Toutes les données collectées sont enregistrées dans deux objectifs principaux&nbsp;:</p>
          <ol className="tw-list-inside tw-list-disc">
            <li>L'intérêt de la personne accompagnée et de son accompagnement, en garantissant un suivi individualisé et adapté.</li>
            <li>
              L'intérêt organisationnel de l'équipe, en cohérence avec les besoins des personnes accompagnées, pour une meilleure coordination et
              planification des actions individuelles et collectives. Les «&nbsp;Équipes&nbsp;» ne peuvent avoir accès qu'aux comptes rendus réalisés
              par les Utilisateurs de leur propre équipe.
            </li>
          </ol>
          <h4 className="tw-mt-4 tw-mb-2 tw-text-main">A - Accès, visualisation et modification de l'agenda</h4>
          <p>
            L'agenda offre à l'équipe une vision temporelle claire des actions et des consultations (dans le cas des professionnels de santé)
            planifiées pour l'ensemble des personnes accompagnées par l'Organisation. Cet outil facilite l'organisation quotidienne en centralisant
            les tâches et les rendez-vous à réaliser, qu'il s'agisse d'accompagnement, de soins ou de démarches administratives. En permettant de
            visualiser les activités passées, présentes et à venir, l'agenda contribue à une meilleure coordination et réduit le risque de manquer des
            rendez-vous importants. Chaque entrée dans l'agenda est classée par date et heure, avec un champ libre pour ajouter des informations
            spécifiques, offrant ainsi une gestion précise et adaptable des priorités de l'équipe.
          </p>
          <h4 className="tw-mt-4 tw-mb-2 tw-text-main">B - Gestion des personnes suivies</h4>
          <p>
            Les profils «&nbsp;Utilisateurs&nbsp;» disposent de nombreuses fonctionnalités leur permettant d'optimiser le suivi des personnes
            accompagnées. À travers l'onglet «&nbsp;personnes suivies&nbsp;», ils peuvent notamment&nbsp;:
          </p>
          <ol className="tw-list-inside tw-list-disc">
            <li>
              Créer un nouveau dossier pour une personne accompagnée lorsqu'ils rencontrent un nouvel usager. L'utilisateur saisit les informations
              identifiantes, telles que le nom, le prénom, le genre, la date de naissance, ainsi que des données relatives à la situation de la
              personne et nécessaire à l'accompagnement proposé&nbsp;;
            </li>
            <li>Effectuer des recherches ciblées à l'aide de mots-clés (nom, description, commentaires ou actions associées à un dossier).</li>
            <li>
              Créer des actions planifiées à réaliser avec ou pour les personnes accompagnées. Ces actions, définies librement par les organisations,
              sont associées à une personne et à une date précise. Un champ libre permet de préciser les détails de chaque action, tandis que
              l'urgence peut être spécifiée par les utilisateurs ou l'Organisation.
            </li>
            <li>Visualiser la liste des personnes suivies, avec une mise en évidence spécifique</li>
          </ol>
          <h4 className="tw-mt-4 tw-mb-2 tw-text-main">C - Statistique des équipes</h4>
          <p>
            Les profils «&nbsp;Utilisateurs&nbsp;» peuvent suivre et avoir accès aux statistiques de la prise en charge via un onglet spécifique. La
            page permet &nbsp;:
          </p>
          <ol className="tw-list-inside tw-list-disc">
            <li>Des statistiques générales, sur le nombre de personnes suivies, le nombre d'actions réalisées et le nombre de rencontres&nbsp;;</li>
            <li>
              Des statistiques spécifiques sur l'accueil et les actions réalisées (typologie d'accueil, répartition des actions par catégorie et
              nombre de Services rendus)&nbsp;;
            </li>
            <li>
              Des statistiques spécifiques sur les personnes suivies (nombre de personnes suivies, temps de suivi moyen, temps d'errance des personnes
              en moyenne, typologie de nationalité, genre, situation personnelle, motif de situation de rue, ressources des personnes suivies, tranche
              d'âges, durée du suivi, temps d'errance, type d'hébergement, couverture médicale des personnes, personnes très vulnérables, pathologies
              chroniques)&nbsp;;
            </li>
            <li>Statistiques relatives aux passages, rencontres, observations et comptesrendus&nbsp;;</li>
            <li>Statistiques relatives aux consultations.</li>
            <li>Globalement, les statistiques sont le reflet du paramétrage de l'organisation.</li>
          </ol>
          <h4 className="tw-mt-4 tw-mb-2 tw-text-main">D - Accès, création et gestion d'un dossier médical</h4>
          <p>
            Parmi les profils «&nbsp;Utilisateurs&nbsp;», seuls les professionnels de santé peuvent avoir accès aux dossiers médicaux.
            L'administrateur ayant créé le compte «&nbsp;Utilisateur&nbsp;» détermine si le compte créé l'est pour un professionnel de santé ou non.
          </p>
          <p>Ces comptes utilisateurs spécifiques vont pouvoir&nbsp;:</p>
          <ol className="tw-list-inside tw-list-disc">
            <li>
              Créer un dossier médical qui ne sera pas visible ou accessible aux autres utilisateurs n'étant pas Utilisateur «&nbsp;professionnel de
              santé &nbsp;»&nbsp;;
            </li>
            <li>
              Créer des «&nbsp;consultations&nbsp;» médicales qui permettent de renseigner des champs relatifs aux personnes suivies lors de
              consultations&nbsp;;
            </li>
            <li>Entrer et visualiser les informations médicales des personnes suivies</li>
            <li>Renseigner et consulter l'évolution des constantes des personnes suivies lorsque cela est nécessaire</li>
            <li>
              Ajouter des documents relatifs à la situation médicale de la personne suivie. Ces documents ne seront visibles que par les
              professionnels de santé&nbsp;;
            </li>
          </ol>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">4.4 Fonctionnalités du profil Utilisateur «&nbsp;restreint&nbsp;»</h3>
          <p>
            L'Utilisateur «&nbsp;restreint&nbsp;» est un agent qui aura accès à un dossier avec des informations très limités&nbsp;: nom, prénom, date
            de naissance, pseudo.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">4.5 Import et export de document</h3>
          <p>Les fonctions d'import et d'export de document dépendent des différents profils.</p>
          <p>
            Les profils Utilisateur «&nbsp;professionnels de santé&nbsp;» peuvent importer et exporter toutes les informations, y compris celles
            relatives aux dossiers médicaux des personnes suivies.
          </p>
          <p>Les profils «&nbsp;accès restreint&nbsp;» n'ont accès qu'aux données d'identifications des personnes.</p>
          <p>
            Les profils «&nbsp;statistiques seulement&nbsp;» n'ont pas accès aux données nominatives, et n'ont donc pas accès aux documents relatifs à
            l'accompagnement des personnes suivies stockés dans leurs dossiers.
          </p>
          <p>
            Les autres profils peuvent importer et exporter les documents relatifs à l'accompagnement, à l'exception des données des dossiers médicaux
            des personnes suives.
          </p>
        </section>
        <section>
          <h2 className="tw-mt-10 tw-text-main">Article 5 - Responsabilités</h2>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">5.1 Responsabilités de SESAN</h3>
          <p>
            Les sources des informations diffusées sur l'outil sont réputées fiables mais l'outil ne garantit pas qu'elles soient exemptes de défauts,
            d'erreurs ou d'omissions.
          </p>
          <p>
            Le SESAN s'engage à la sécurisation de l'outil, notamment en prenant toutes les mesures nécessaires permettant de garantir la sécurité et
            la confidentialité des informations fournies.
          </p>
          <p>
            Le SESAN fournit les moyens nécessaires et raisonnables pour assurer un accès continu à l'application. Il se réserve la liberté de faire
            évoluer, de modifier ou de suspendre, sans préavis, l'application pour des raisons de maintenance ou pour tout autre motif jugé
            nécessaire.
          </p>
          <p>
            Le SESAN déclare avoir souscrit une police d'assurance auprès d'une compagnie d'assurance notoirement solvable couvrant sa responsabilité
            civile au titre des présentes Conditions Générales d'Utilisation. Le SESAN s'oblige à maintenir en vigueur ladite police d'assurance
            pendant toute la durée de la mise en ligne du Service.
          </p>
          <p>
            En cas de force majeure, telle que définie par la loi française et interprétée par les juridictions françaises, la non- exécution de l'une
            quelconque de ses obligations contractuelles par l'une ou l'autre des Parties n'engage pas sa responsabilité.
          </p>
          <p>
            Le SESAN s'engage à notifier immédiatement à chaque Organisation et/ou Utilisateur, dès qu'il en a connaissance, tout incident grave,
            toute intrusion, divulgation, accès illicite ou altération et toute tentative d'intrusion, divulgation, accès illicite ou altération du
            Service ou toute malveillance contre les données à caractère personnel ayant ou susceptible d'avoir un impact grave pour l'Organisation
            et/ou l'Utilisateur.
          </p>
          <p>
            Par ailleurs, les Organisations et utilisateurs acceptent les caractéristiques et limites d'internet et, en particulier, reconnaissent
            avoir connaissance de la nature du réseau Internet et notamment de ses performances techniques. La responsabilité de SESAN ne saurait être
            engagée à quelque titre que ce soit, sans que cette liste ne soit limitative&nbsp;:
          </p>
          <ol className="tw-list-inside tw-list-disc">
            <li>En cas de modification, suspension, interruption volontaire ou non, indisponibilité totale ou partielle du Service&nbsp;;</li>
            <li>
              Pour tout ce qui est inhérent à la fiabilité de la transmission des données, aux temps d'accès, et éventuelles restrictions du réseau
              Internet ou des réseaux qui lui sont connectés.
            </li>
            <li>
              En cas d'interruption des réseaux d'accès au Service, d'erreur de transmission ou de problèmes liés à la sécurité des transmissions, en
              cas de défaillance du matériel de réception.
            </li>
          </ol>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">5.2 Les Organisations</h3>
          <p>
            Les Organisations personnes morales détiennent la clé de chiffrement des données contenues dans MANO. Elles s'assurent de garder la clé
            secrète et d'en limiter l'accès aux personnes habilitées au sein de l'Organisation.
          </p>
          <p>
            Chaque Organisation identifie les professionnels de santé pouvant avoir accès aux dossiers médicaux. Elles demeurent responsables de
            l'habilitation ainsi générée et du respect de la confidentialité des informations inscrites dans MANO.
          </p>
          <p>
            Les Organisations s'assurent de garder leurs mots de passe secret. Toute divulgation du mot de passe, quelle que soit sa forme, est
            interdite. Elles assument les risques liés à l'utilisation de son identifiant et mot de passe.
          </p>
          <p>
            Elles s'engagent à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi.
          </p>
          <p>
            Chaque organisation reconnaît et accepte que le rôle de SESAN se limite au maintien en conditions opérationnelles du Service et à la
            création de comptes Administrateurs et Utilisateur c'est-à-dire à des prestations purement techniques. SESAN n'accède pas aux données des
            usagers ni aux clés de déchiffrement.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">5.3 L'Utilisateur</h3>
          <p>
            L'Utilisateur s'assure de garder son mot de passe secret. Toute divulgation du mot de passe, quelle que soit sa forme, est interdite. Il
            assume les risques liés à l'utilisation de son identifiant et mot de passe.
          </p>
          <p>Le mot de passe sera composé d'au minimum douze caractères comprenant des majuscules, des minuscules et des caractères spéciaux.</p>
          <p>Il s'engage à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi.</p>
          <p>
            Toute information transmise par l'Utilisateur est de sa seule responsabilité. La Responsabilité de SESAN se limitant uniquement au
            maintien en conditions opérationnelles du Service et à la création de comptes administrateurs et Utilisateurs pour les structures. Il est
            rappelé que toute personne procédant à une fausse déclaration pour elle-même ou pour autrui s'expose, notamment, aux sanctions prévues à
            l'article 441-1 du code pénal, prévoyant des peines pouvant aller jusqu'à trois ans d'emprisonnement et 45 000 euros d'amende.
          </p>
          <p>
            L'Utilisateur s'engage à ne pas mettre en ligne de contenus ou informations contraires aux dispositions légales et réglementaires en
            vigueur.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">5.4 Le «&nbsp;Professionnel de santé&nbsp;»</h3>
          <p>
            Le Professionnel de santé s'assure de garder son mot de passe secret. Toute divulgation du mot de passe, quelle que soit sa forme, est
            interdite. Il assume les risques liés à l'utilisation de son identifiant et mot de passe. Le mot de passe sera composé d'au minimum douze
            caractères comprenant des majuscules, des minuscules et des caractères spéciaux.
          </p>
          <p>Il s'engage à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi.</p>
          <p>
            Nous rappelons que les Professionnels de santé sont soumis au secret professionnel et ne peuvent communiquer des informations sur des
            personnes prises en charge que conformément aux dispositions de l'article 1110-4 du code de la santé publique.
          </p>
          <p>
            Toute information transmise par le Professionnel de santé est de sa seule responsabilité. Il est rappelé que toute personne procédant à
            une fausse déclaration pour elle-même ou pour autrui s'expose, notamment, aux sanctions prévues à l'article 441-1 du code pénal, prévoyant
            des peines pouvant aller jusqu'à trois ans d'emprisonnement et 45 000 euros d'amende.
          </p>
          <p>
            Il s'engage notamment à ne pas mettre en ligne de contenus ou informations contraires aux dispositions légales et réglementaires en
            vigueur.
          </p>
          <p>Il est rappelé que le SESAN n'a pas accès aux données renseignées par le Professionnel de santé.</p>
        </section>
        <section>
          <h2 className="tw-mb-4 tw-mt-10 tw-text-main">Article 6 – Hébergement de données de santé</h2>
          <p>
            Chaque Organisation et Utilisateur de santé déclare être parfaitement informé que le SESAN n'est pas hébergeur de données de Santé. Le
            SESAN fait recours à un tiers hébergeur agréé.
          </p>
          <p>
            Les Utilisateurs de MANO sont seuls responsables de l'utilisation qu'ils font du Service. Le SESAN ne peut garantir la pertinence,
            l'actualité et/ou la véracité des informations et des données à caractère personnel accessibles ou transmises via le Service, celles-ci
            étant fournies par les différentes catégories de personnes concernées susindiquées, sans possibilité de contrôle de SESAN.
          </p>
        </section>
        <section>
          <h2 className="tw-mb-4 tw-mt-10 tw-text-main">Article 7 Dispositions diverses</h2>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.1 Stipulations diverses</h3>
          <p>
            Dans l'hypothèse où une seule ou plusieurs stipulations des présentes seraient considérées comme nulles ou non avenues, cette disposition
            sera supprimée. Ni la validité, ni l'opposabilité des autres dispositions n'en seraient affectées.
          </p>
          <p>
            Le fait que l'une ou l'autre des Parties ne se prévale pas un moment donné de l'une des quelconques clauses ou qu'elle tolère
            l'inexécution de façon temporaire ou permanente des obligations de l'autre Partie ne peut être interprété comme valant renonciation à s'en
            prévaloir ultérieurement.
          </p>
          <p>
            Le fait pour l'une ou l'autre des Parties de tolérer une inexécution ou une exécution imparfaite des présentes Conditions Générales
            d'Utilisation ou, plus généralement, de tolérer tout acte, abstention ou omission de l'autre Partie non conforme aux stipulations des
            présentes Conditions Générales d'Utilisation ne saurait conférer un droit quelconque à la Partie bénéficiant de cette tolérance.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.2 Contenus illicites</h3>
          <p>Tout utilisateur ou organisation constatant la présence d'un contenu illicite s'engage à le déclarer à SESAN. </p>
          <p>
            Conformément à l'article 6-I.5 de la loi n°2004-575 pour la confiance dans l'économie numérique, cette notification doit impérativement
            comporter&nbsp;:
          </p>
          <ol className="tw-list-inside tw-list-disc">
            <li>La date de la notification.</li>
            <li>Si le notifiant est une personne physique&nbsp;: ses noms, prénoms, profession, domicile, nationalité, date et lieu de naissance.</li>
            <li>
              Si le notifiant est une personne morale&nbsp;: sa forme, sa dénomination, son siège social et l'organe qui la représente légalement.
            </li>
            <li>La description précise des faits litigieux et leur localisation précise.</li>
            <li>Les motifs pour lesquels le contenu doit être retiré</li>
          </ol>
          <p>
            Le SESAN s'engage à prendre toutes les mesures appropriées s'il considère le contenu contraire à l'ordre public, aux bonnes mœurs ou à la
            finalité du Service.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.3 Cookies</h3>
          <p>
            La Plateforme peut implanter sur le terminal informatique de l'Utilisateur des cookies, dont l'objectif est d'une part d'assurer le bon
            fonctionnement de la Plateforme, d'autre part de mesurer l'audience de la Plateforme.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.4 Disponibilité et maintenance</h3>
          <p>
            SESAN s'engage à faire le nécessaire pour assurer une disponibilité du Service. SESAN se réserve la possibilité d'interrompre, suspendre
            ou modifier temporairement et sans préavis l'accès au Service, et ce notamment pour des raisons de sécurité, pour la maintenance ou
            l'amélioration du Service ou pour améliorer la disponibilité des informations.
          </p>
          <p>
            SESAN s'engage à fournir tous les efforts nécessaires pour informer les utilisateurs ou leurs organisations préalablement à cette
            interruption du Service. L'indisponibilité du Service ne donne droit à aucune indemnité.
          </p>
          <p>
            Par ailleurs, l'utilisateur s'engage à contribuer à l'amélioration du Service, en signalant les défauts éventuels et, le cas échéant, en
            proposant toute amélioration.
          </p>
          <p>
            Dans ce laps de temps, seul SESAN peut corriger ou faire corriger les défauts ou recourir, si nécessaire, à une solution de contournement
            pour remédier aux défauts.
          </p>
          <p>
            Le Service est distribué sous licence «&nbsp;open source&nbsp;» spécifique que l'utilisateur est tenu d'approuver, préalablement à leur
            utilisation.{" "}
          </p>
          <p>
            Les garanties consenties aux utilisateurs dans le cadre des présentes Conditions Générales d'Utilisation sont exclusives de toute autre
            garantie légale ou contractuelle, explicite ou implicite.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.5 Caducité</h3>
          <p>
            La relation contractuelle régie par les présentes Conditions Générales d'Utilisation est indépendante de tout autre contrat, même passé
            entre les parties et/ou si un tel contrat devait être nécessaire à la réalisation d'une opération d'ensemble envisagée par l'une ou
            l'autre des Parties. Partant, la disparition, pour quelle que cause que ce soit, de l'un quelconque des contrats de l'ensemble,
            n'entraînera pas la caducité de la relation contractuelle régie par les présentes Conditions Générales d'Utilisation.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.6 Restriction d'accès</h3>
          <p>
            En cas de manquement aux obligations des présentes Conditions Générales d'Utilisation, SESAN se réserve la possibilité de restreindre
            l'accès au Service concerné en suspendant à titre conservatoire le Compte d'accès concerné ou de suspendre à titre conservatoire le compte
            administrateur créé par un l'organisation.
          </p>
          <p>
            Lorsqu'il envisage de prendre une mesure de restriction ou de suspension, SESAN en informe sans délai et par tout moyen l'organisation
            et/ou l'utilisateur, en lui indiquant le ou les manquements à l'origine de cette décision, les moyens d'y remédier, le cas échéant, et la
            possibilité de faire valoir ses arguments dans un délai de quinze (15) jours suivant la notification. La mesure de restriction ou de
            suspension ne peut être prise que si au terme de ce délai, le ou les manquements persistent et après que l'Utilisateur et/ou
            l'Organisation a été mis en mesure de faire valoir ses arguments.
          </p>
          <p>
            Par exception à ce qui précède, en cas de manquement compromettant la sécurité et la confidentialité des données à caractère personnel, du
            Service ou lorsque le manquement est insusceptible de régularisation, la mesure de restriction ou de suspension peut être prise
            directement et avec effet immédiat par le SESAN. Le cas échéant, la mesure est portée à la connaissance du concerné sans délai et par tout
            moyen. Ce dernier dispose d'un délai de quinze (15) jours, suivant la notification, pour présenter ses arguments et demander la levée de
            la mesure.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.7 Conflit entre les parties</h3>
          <p>
            Tout litige qui surviendrait concernant la conclusion, l'interprétation et l'exécution des présentes devra faire l'objet d'une tentative
            de règlement amiable. Toutefois, pendant la période de règlement amiable, le SESAN conserve la possibilité de prendre des mesures de
            restriction d'accès au Service à titre conservatoire.
          </p>
          <p>
            En cas de non résolution amiable du conflit dans un délai d'un (1) mois, la partie la plus diligente pourra saisir le Tribunal compétent.
          </p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.8 Droit applicable</h3>
          <p>Les conditions générales d'utilisation sont soumises à la loi française.</p>
          <h3 className="tw-mt-4 tw-mb-2 tw-text-main">7.9 Mise à jour des conditions d'utilisation</h3>
          <p>
            Les termes des présentes conditions générales d'utilisation peuvent être amendés à tout moment, en fonction des modifications apportées à
            l'outil, de l'évolution de la législation ou pour tout autre motif jugé nécessaire. Chaque modification donne lieu à une nouvelle version
            qui est acceptée par les parties.
          </p>
        </section>
      </main>
      <ButtonCustom
        className="tw-m-auto tw-mt-20 tw-w-56 tw-rounded-3xl tw-text-base"
        loading={loading}
        type="submit"
        color="primary"
        title="Accepter et continuer"
        onClick={onSigninValidated}
      />
      <a className="tw-mb-20 tw-mt-3 tw-block tw-text-xs" href="/cgu.pdf" target="_blank" rel="noreferrer">
        Télécharger le .pdf <OpenNewWindowIcon />
      </a>
    </div>
  );
};

export default CGUs;

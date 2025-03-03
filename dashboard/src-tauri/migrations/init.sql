DROP TABLE IF EXISTS person_history_team;

DROP TABLE IF EXISTS person_team;

DROP TABLE IF EXISTS person_history;

DROP TABLE IF EXISTS person_group;

DROP TABLE IF EXISTS person_group_relation;

DROP TABLE IF EXISTS person_place;

DROP TABLE IF EXISTS action_category;

DROP TABLE IF EXISTS action_team;

DROP TABLE IF EXISTS consultation_team;

DROP TABLE IF EXISTS territory_observation;

DROP TABLE IF EXISTS user_team;

DROP TABLE IF EXISTS treatment;

DROP TABLE IF EXISTS structure;

DROP TABLE IF EXISTS territory;

DROP TABLE IF EXISTS place;

DROP TABLE IF EXISTS "group";

DROP TABLE IF EXISTS comment;

DROP TABLE IF EXISTS passage;

DROP TABLE IF EXISTS rencontre;

DROP TABLE IF EXISTS action;

DROP TABLE IF EXISTS recurrence;

DROP TABLE IF EXISTS consultation;

DROP TABLE IF EXISTS medical_file;

DROP TABLE IF EXISTS person;

DROP TABLE IF EXISTS report;

DROP TABLE IF EXISTS team;

DROP TABLE IF EXISTS user;

CREATE TABLE IF NOT EXISTS action (
  _id PRIMARY KEY,
  name TEXT,
  personId TEXT,
  groupId TEXT,
  description TEXT,
  withTime INTEGER,
  urgent INTEGER,
  documents TEXT,
  recurrenceId TEXT,
  userId TEXT,
  dueAt TEXT,
  completedAt TEXT,
  status TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS action_category (
  actionId TEXT,
  categoryId TEXT,
  FOREIGN KEY (actionId) REFERENCES action (_id) DEFERRABLE INITIALLY DEFERRED constraint pk_action_category primary key (actionId, categoryId) on conflict replace
);

CREATE TABLE IF NOT EXISTS action_team (
  actionId TEXT,
  teamId TEXT,
  FOREIGN KEY (actionId) REFERENCES action (_id) DEFERRABLE INITIALLY DEFERRED constraint pk_action_team primary key (actionId, teamId) on conflict replace
);

CREATE TABLE IF NOT EXISTS comment (
  _id PRIMARY KEY ON CONFLICT REPLACE,
  comment TEXT,
  personId TEXT,
  actionId TEXT,
  consultationId TEXT,
  medicalFileId TEXT,
  groupId TEXT,
  teamId TEXT,
  userId TEXT,
  date TEXT,
  urgent INTEGER,
  share INTEGER,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS team (
  _id PRIMARY KEY,
  name TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE person (
  _id PRIMARY KEY,
  name TEXT,
  otherNames TEXT,
  gender TEXT,
  birthdate TEXT,
  description TEXT,
  alertness INTEGER,
  wanderingAt TEXT,
  phone TEXT,
  email TEXT,
  followedSince TEXT,
  outOfActiveList INTEGER,
  outOfActiveListReasons TEXT,
  outOfActiveListDate TEXT,
  documents TEXT,
  userId TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE person_team (
  personId TEXT,
  teamId TEXT,
  FOREIGN KEY (personId) REFERENCES person (_id) constraint pk_person_team primary key (personId, teamId) on conflict replace
);

CREATE TABLE person_history (
  personId TEXT,
  name TEXT,
  otherNames TEXT,
  gender TEXT,
  birthdate TEXT,
  description TEXT,
  alertness INTEGER,
  wanderingAt TEXT,
  phone TEXT,
  email TEXT,
  followedSince TEXT,
  outOfActiveList INTEGER,
  outOfActiveListReasons TEXT,
  outOfActiveListDate TEXT,
  documents TEXT,
  userId TEXT,
  fromDate TEXT,
  toDate TEXT,
  createdAt TEXT,
  --   updatedAt TEXT, ???
  --   deletedAt TEXT, ???
  constraint pk_person_history primary key (personId, fromDate) on conflict replace
);

CREATE TABLE person_history_team (
  personId TEXT,
  teamId TEXT,
  fromDate TEXT,
  toDate TEXT,
  FOREIGN KEY (personId, fromDate) REFERENCES person_history (personId, fromDate) constraint pk_person_history_team primary key (personId, fromDate, teamId) on conflict replace
);

-- TODO: Comment ajouter les custom fields?
CREATE TABLE IF NOT EXISTS consultation (
  _id PRIMARY KEY,
  personId TEXT,
  name TEXT,
  type TEXT,
  documents TEXT,
  "constantes-poids" TEXT,
  "constantes-frequence-cardiaque" TEXT,
  "constantes-taille" TEXT,
  "constantes-saturation-o2" TEXT,
  "constantes-temperature" TEXT,
  "constantes-glycemie-capillaire" TEXT,
  "constantes-frequence-respiratoire" TEXT,
  "constantes-tension-arterielle-systolique" TEXT,
  "constantes-tension-arterielle-diastolique" TEXT,
  userId TEXT,
  dueAt TEXT,
  completedAt TEXT,
  status TEXT,
  onlyVisibleBy TEXT,
  customFields TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS consultation_team (
  consultationId TEXT,
  teamId TEXT,
  FOREIGN KEY (consultationId) REFERENCES consultation (_id) constraint pk_consultation_team primary key (consultationId, teamId) on conflict replace
);

CREATE TABLE IF NOT EXISTS medical_file (
  _id PRIMARY KEY,
  personId TEXT,
  documents TEXT,
  customFields TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS "group" (
  _id PRIMARY KEY,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS person_group (personId TEXT, groupId TEXT);

CREATE TABLE IF NOT EXISTS person_group_relation (
  groupId TEXT,
  person1Id TEXT,
  person2Id TEXT,
  description TEXT,
  userId TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY (groupId) REFERENCES "group" (_id) constraint pk_person_group_relation primary key (groupId, person1Id, person2Id) on conflict replace
);

CREATE TABLE IF NOT EXISTS passage (
  _id PRIMARY KEY,
  comment TEXT,
  personId TEXT,
  teamId TEXT,
  userId TEXT,
  date TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS rencontre (
  _id PRIMARY KEY,
  comment TEXT,
  personId TEXT,
  teamId TEXT,
  userId TEXT,
  date TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS place (
  _id PRIMARY KEY,
  name TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS person_place (personId TEXT, placeId TEXT, userId TEXT);

CREATE TABLE IF NOT EXISTS recurrence (
  _id PRIMARY KEY,
  startDate TEXT,
  endDate TEXT,
  timeInterval INTEGER,
  timeUnit TEXT,
  selectedDays TEXT,
  recurrenceTypeForMonthAndYear TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS report (
  _id PRIMARY KEY,
  description TEXT,
  date TEXT,
  collaborations TEXT,
  team TEXT,
  updatedBy TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS structure (
  _id PRIMARY KEY,
  name TEXT,
  phone TEXT,
  adresse TEXT,
  city TEXT,
  postcode TEXT,
  description TEXT,
  categories TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS territory (
  _id PRIMARY KEY,
  name TEXT,
  perimeter TEXT,
  description TEXT,
  types TEXT,
  userId TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS territory_observation (
  _id PRIMARY KEY,
  territoryId TEXT,
  userId TEXT,
  teamId TEXT,
  observedAt TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS treatment (
  _id PRIMARY KEY,
  personId TEXT,
  userId TEXT,
  startDate TEXT,
  endDate TEXT,
  name TEXT,
  dosage TEXT,
  frequency TEXT,
  indication TEXT,
  documents TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS user (
  _id PRIMARY KEY,
  name TEXT,
  phone TEXT,
  email TEXT,
  role TEXT,
  healthcareProfessional INTEGER,
  lastChangePasswordAt TEXT,
  termsAccepted INTEGER,
  cgusAccepted INTEGER,
  gaveFeedbackEarly2023 INTEGER,
  lastLoginAt TEXT,
  decryptAttempts INTEGER,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS user_team (
  userId TEXT,
  teamId TEXT,
  FOREIGN KEY (userId) REFERENCES user (_id) constraint pk_user_team primary key (userId, teamId) on conflict replace
);

CREATE INDEX IF NOT EXISTS idx_action_personId ON action (personId);

CREATE INDEX IF NOT EXISTS idx_action_dueAt ON action (dueAt);

CREATE INDEX IF NOT EXISTS idx_action_completedAt ON action (completedAt);

CREATE INDEX IF NOT EXISTS idx_action_createdAt ON action (createdAt);

CREATE INDEX IF NOT EXISTS idx_action_status ON action (status);

CREATE INDEX IF NOT EXISTS idx_person_createdAt ON person (createdAt);

CREATE INDEX IF NOT EXISTS idx_person_updatedAt ON person (updatedAt);

CREATE INDEX IF NOT EXISTS idx_person_deletedAt ON person (deletedAt);

CREATE INDEX IF NOT EXISTS idx_person_followedSince ON person (followedSince);

CREATE INDEX IF NOT EXISTS idx_person_outOfActiveList ON person (outOfActiveList);

CREATE INDEX IF NOT EXISTS idx_person_history_fromDate ON person_history (fromDate);

CREATE INDEX IF NOT EXISTS idx_person_history_toDate ON person_history (toDate);

CREATE INDEX IF NOT EXISTS idx_person_history_personId ON person_history (personId);

CREATE INDEX IF NOT EXISTS idx_person_history_teamId ON person_history_team (teamId);

CREATE INDEX IF NOT EXISTS idx_person_history_team_personId ON person_history_team (personId);

CREATE INDEX IF NOT EXISTS idx_person_history_team_fromDate ON person_history_team (fromDate);

CREATE INDEX IF NOT EXISTS idx_person_history_team_toDate ON person_history_team (toDate);

CREATE INDEX IF NOT EXISTS idx_consultation_personId ON consultation (personId);

CREATE INDEX IF NOT EXISTS idx_consultation_dueAt ON consultation (dueAt);

CREATE INDEX IF NOT EXISTS idx_consultation_completedAt ON consultation (completedAt);

CREATE INDEX IF NOT EXISTS idx_consultation_createdAt ON consultation (createdAt);

CREATE INDEX IF NOT EXISTS idx_passage_personId ON passage (personId);

CREATE INDEX IF NOT EXISTS idx_passage_date ON passage (date);

CREATE INDEX IF NOT EXISTS idx_passage_createdAt ON passage (createdAt);

CREATE INDEX IF NOT EXISTS idx_rencontre_personId ON rencontre (personId);

CREATE INDEX IF NOT EXISTS idx_rencontre_date ON rencontre (date);

CREATE INDEX IF NOT EXISTS idx_rencontre_createdAt ON rencontre (createdAt);

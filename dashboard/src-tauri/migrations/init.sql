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

DROP TABLE IF EXISTS organisation_person_field;

CREATE TABLE IF NOT EXISTS organisation_person_field (
  id PRIMARY KEY,
  type TEXT,
  label TEXT,
  options TEXT,
  read_only INTEGER,
  medical INTEGER,
  group_name TEXT,
  original_id TEXT
);

CREATE TABLE IF NOT EXISTS action (
  id PRIMARY KEY,
  name TEXT,
  person_id TEXT,
  group_id TEXT,
  description TEXT,
  with_time INTEGER,
  urgent INTEGER,
  documents TEXT,
  recurrence_id TEXT,
  user_id TEXT,
  due_at TEXT,
  completed_at TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS action_category (
  action_id TEXT,
  category_id TEXT,
  FOREIGN KEY (action_id) REFERENCES action (id) DEFERRABLE INITIALLY DEFERRED constraint pk_action_category primary key (action_id, category_id) on conflict replace
);

CREATE TABLE IF NOT EXISTS action_team (
  action_id TEXT,
  team_id TEXT,
  FOREIGN KEY (action_id) REFERENCES action (id) DEFERRABLE INITIALLY DEFERRED constraint pk_action_team primary key (action_id, team_id) on conflict replace
);

CREATE TABLE IF NOT EXISTS comment (
  id PRIMARY KEY ON CONFLICT REPLACE,
  comment TEXT,
  person_id TEXT,
  action_id TEXT,
  consultation_id TEXT,
  medical_file_id TEXT,
  group_id TEXT,
  team_id TEXT,
  user_id TEXT,
  date TEXT,
  urgent INTEGER,
  share INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS team (
  id PRIMARY KEY,
  name TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE person (
  id PRIMARY KEY,
  name TEXT,
  other_names TEXT,
  gender TEXT,
  birthdate TEXT,
  description TEXT,
  alertness TEXT,
  wandering_at TEXT,
  phone TEXT,
  email TEXT,
  followed_since TEXT,
  out_of_active_list TEXT,
  out_of_active_list_date TEXT,
  documents TEXT,
  user_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE person_team (
  person_id TEXT,
  team_id TEXT,
  FOREIGN KEY (person_id) REFERENCES person (id) constraint pk_person_team primary key (person_id, team_id) on conflict replace
);

CREATE TABLE person_history (
  person_id TEXT,
  name TEXT,
  other_names TEXT,
  gender TEXT,
  birthdate TEXT,
  description TEXT,
  alertness TEXT,
  wandering_at TEXT,
  phone TEXT,
  email TEXT,
  followed_since TEXT,
  out_of_active_list TEXT,
  out_of_active_list_date TEXT,
  documents TEXT,
  user_id TEXT,
  from_date TEXT,
  to_date TEXT,
  constraint pk_person_history primary key (person_id, from_date) on conflict replace
);

CREATE TABLE person_history_team (
  person_id TEXT,
  team_id TEXT,
  from_date TEXT,
  to_date TEXT,
  FOREIGN KEY (person_id, from_date) REFERENCES person_history (person_id, from_date) constraint pk_person_history_team primary key (person_id, from_date, team_id) on conflict replace
);

-- TODO: Comment ajouter les custom fields?
CREATE TABLE IF NOT EXISTS consultation (
  id PRIMARY KEY,
  person_id TEXT,
  name TEXT,
  type TEXT,
  documents TEXT,
  constantes_poids TEXT,
  constantes_frequence_cardiaque TEXT,
  constantes_taille TEXT,
  constantes_saturation_o2 TEXT,
  constantes_temperature TEXT,
  constantes_glycemie_capillaire TEXT,
  constantes_frequence_respiratoire TEXT,
  constantes_tension_arterielle_systolique TEXT,
  constantes_tension_arterielle_diastolique TEXT,
  user_id TEXT,
  due_at TEXT,
  completed_at TEXT,
  status TEXT,
  onlyVisibleBy TEXT,
  custom_fields TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS consultation_team (
  consultation_id TEXT,
  team_id TEXT,
  FOREIGN KEY (consultation_id) REFERENCES consultation (id) constraint pk_consultation_team primary key (consultation_id, team_id) on conflict replace
);

CREATE TABLE IF NOT EXISTS medical_file (
  id PRIMARY KEY,
  person_id TEXT,
  documents TEXT,
  custom_fields TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS "group" (
  id PRIMARY KEY,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS person_group (
  person_id TEXT,
  group_id TEXT,
  FOREIGN KEY (person_id) REFERENCES person (id) constraint pk_person_group primary key (person_id, group_id) on conflict replace
);

CREATE TABLE IF NOT EXISTS person_group_relation (
  group_id TEXT,
  person_1_id TEXT,
  person_2_id TEXT,
  description TEXT,
  user_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (group_id) REFERENCES "group" (id) constraint pk_person_group_relation primary key (group_id, person_1_id, person_2_id) on conflict replace
);

CREATE TABLE IF NOT EXISTS passage (
  id PRIMARY KEY,
  comment TEXT,
  person_id TEXT,
  team_id TEXT,
  user_id TEXT,
  date TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS rencontre (
  id PRIMARY KEY,
  comment TEXT,
  person_id TEXT,
  team_id TEXT,
  user_id TEXT,
  date TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS place (
  id PRIMARY KEY,
  name TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS person_place (person_id TEXT, place_id TEXT, user_id TEXT);

CREATE TABLE IF NOT EXISTS recurrence (
  id PRIMARY KEY,
  start_date TEXT,
  end_date TEXT,
  time_interval INTEGER,
  time_unit TEXT,
  selected_days TEXT,
  recurrence_type_for_month_and_year TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS report (
  id PRIMARY KEY,
  description TEXT,
  date TEXT,
  collaborations TEXT,
  team TEXT,
  updated_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS structure (
  id PRIMARY KEY,
  name TEXT,
  phone TEXT,
  adresse TEXT,
  city TEXT,
  postcode TEXT,
  description TEXT,
  categories TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS territory (
  id PRIMARY KEY,
  name TEXT,
  perimeter TEXT,
  description TEXT,
  types TEXT,
  user TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS territory_observation (
  id PRIMARY KEY,
  territory_id TEXT,
  user_id TEXT,
  team_id TEXT,
  observed_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS treatment (
  id PRIMARY KEY,
  person_id TEXT,
  user_id TEXT,
  startDate TEXT,
  endDate TEXT,
  name TEXT,
  dosage TEXT,
  frequency TEXT,
  indication TEXT,
  documents TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user (
  id PRIMARY KEY,
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
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS user_team (
  user_id TEXT,
  team_id TEXT,
  FOREIGN KEY (user_id) REFERENCES user (id) constraint pk_user_team primary key (user_id, team_id) on conflict replace
);

CREATE INDEX IF NOT EXISTS idx_action_person_id ON action (person_id);

CREATE INDEX IF NOT EXISTS idx_action_due_at ON action (due_at);

CREATE INDEX IF NOT EXISTS idx_action_completed_at ON action (completed_at);

CREATE INDEX IF NOT EXISTS idx_action_created_at ON action (created_at);

CREATE INDEX IF NOT EXISTS idx_action_status ON action (status);

CREATE INDEX IF NOT EXISTS idx_person_created_at ON person (created_at);

CREATE INDEX IF NOT EXISTS idx_person_updated_at ON person (updated_at);

CREATE INDEX IF NOT EXISTS idx_person_deleted_at ON person (deleted_at);

CREATE INDEX IF NOT EXISTS idx_person_followed_since ON person (followed_since);

CREATE INDEX IF NOT EXISTS idx_person_out_of_active_list ON person (out_of_active_list);

CREATE INDEX IF NOT EXISTS idx_person_history_from_date ON person_history (from_date);

CREATE INDEX IF NOT EXISTS idx_person_history_to_date ON person_history (to_date);

CREATE INDEX IF NOT EXISTS idx_person_history_person_id ON person_history (person_id);

CREATE INDEX IF NOT EXISTS idx_person_history_team_id ON person_history_team (team_id);

CREATE INDEX IF NOT EXISTS idx_person_history_team_person_id ON person_history_team (person_id);

CREATE INDEX IF NOT EXISTS idx_person_history_team_from_date ON person_history_team (from_date);

CREATE INDEX IF NOT EXISTS idx_person_history_team_to_date ON person_history_team (to_date);

CREATE INDEX IF NOT EXISTS idx_consultation_person_id ON consultation (person_id);

CREATE INDEX IF NOT EXISTS idx_consultation_due_at ON consultation (due_at);

CREATE INDEX IF NOT EXISTS idx_consultation_completed_at ON consultation (completed_at);

CREATE INDEX IF NOT EXISTS idx_consultation_created_at ON consultation (created_at);

CREATE INDEX IF NOT EXISTS idx_passage_person_id ON passage (person_id);

CREATE INDEX IF NOT EXISTS idx_passage_date ON passage (date);

CREATE INDEX IF NOT EXISTS idx_passage_created_at ON passage (created_at);

CREATE INDEX IF NOT EXISTS idx_rencontre_person_id ON rencontre (person_id);

CREATE INDEX IF NOT EXISTS idx_rencontre_date ON rencontre (date);

CREATE INDEX IF NOT EXISTS idx_rencontre_created_at ON rencontre (created_at);

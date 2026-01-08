import React, { useRef, useState } from "react";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { useAtom } from "jotai";
import Loading from "../components/loading";
import ChangePassword from "../components/ChangePassword";
import { userState } from "../atoms/auth";
import API, { tryFetch, tryFetchExpectOk } from "../services/api";
import { ModalBody, ModalContainer, ModalHeader, ModalFooter } from "../components/tailwind/Modal";
import DeleteButtonAndConfirmModal from "../components/DeleteButtonAndConfirmModal";
import { errorMessage } from "../utils";
import { capture } from "../services/sentry";

const Account = () => {
  const [user, setUser] = useAtom(userState);

  if (!user) return <Loading />;

  return (
    <>
      <h1 className="tw-text-xl tw-my-8 tw-font-normal">
        Mon compte: <strong>{user.name}</strong>
      </h1>
      <h3 className="tw-my-10 tw-flex tw-justify-between tw-text-xl tw-font-extrabold">Informations</h3>
      <Formik
        initialValues={user}
        onSubmit={async (body) => {
          const [error] = await tryFetch(async () => API.put({ path: "/user", body }));
          if (!error) {
            toast.success("Mis à jour !");
            const [error, response] = await tryFetchExpectOk(async () => API.get({ path: "/user/me" }));
            if (error) {
              toast.error(errorMessage(error));
              return;
            }
            setUser(response.user);
          } else {
            toast.error(errorMessage(error));
          }
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => (
          <React.Fragment>
            <div className="tw-flex tw-flex-row tw-flex-wrap">
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="orgName">Nom</label>
                  <input
                    className="tailwindui"
                    autoComplete="off"
                    type="text"
                    name="name"
                    id="name"
                    value={values.name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="email">Email</label>
                  <input
                    className="tailwindui"
                    autoComplete="off"
                    type="email"
                    name="email"
                    id="email"
                    value={values.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="tw-flex tw-justify-end tw-items-center">
              <DeleteButtonAndConfirmModal
                buttonText="Supprimer mon compte"
                title={`Voulez-vous vraiment supprimer l'utilisateur ${user.name}`}
                textToConfirm={user.email}
                roles={["admin", "superadmin", "normal", "restricted-access", "stats-only"]}
                onConfirm={async () => {
                  const [error] = await tryFetch(async () => API.delete({ path: "/user/me" }));
                  if (error) return;
                  toast.success("Suppression réussie");
                  window.location.reload();
                }}
              >
                <span className="tw-mb-7 tw-block tw-w-full tw-text-center">Cette opération est irréversible</span>
              </DeleteButtonAndConfirmModal>
              <TestConnexion />
              <LinkToChangePassword />
              <button type="button" className="button-submit" disabled={isSubmitting} onClick={() => handleSubmit()}>
                Mettre à jour
              </button>
            </div>
          </React.Fragment>
        )}
      </Formik>
    </>
  );
};

const LinkToChangePassword = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="button-classic" onClick={() => setOpen(true)}>
        Modifier mon mot de passe
      </button>

      <ModalContainer open={open} onClose={() => setOpen(false)} className="change-password" size="3xl">
        <ModalHeader title="Modifier mon mot de passe" onClose={() => setOpen(false)} />
        <ModalBody className="tw-px-4 tw-py-2">
          <ChangePassword
            onSubmit={async (body: unknown) => {
              const [error, response] = await tryFetch(async () => API.post({ path: `/user/reset_password`, body }));
              if (error) {
                toast.error(errorMessage(error));
              }
              return response;
            }}
            onFinished={() => setOpen(false)}
            withCurrentPassword
          />
        </ModalBody>
      </ModalContainer>
    </>
  );
};

type TestConnexionStatus = "done" | "ongoing" | "not-started";

type TestConnexionFailureSample = {
  index: number;
  error?: string;
  response?: unknown;
  durationMs: number;
};

type TestConnexionResult = {
  intervalMs: number;
  numberOfTests: number;
  startedAt: string;
  endedAt: string;
  okCount: number;
  failCount: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  failures: TestConnexionFailureSample[];
};

function percentile(sortedValues: number[], percentileValue: number) {
  if (!sortedValues.length) return 0;
  const idx = Math.floor((sortedValues.length - 1) * percentileValue);
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, idx))];
}

const TestConnexion = () => {
  const [open, setOpen] = useState(false);
  const [testLaunched, setTestLaunched] = useState(false);
  const [testOneCallEvery2Seconds, setTestOneCallEvery2Seconds] = useState<TestConnexionStatus>("not-started");
  const [testOneCallEvery1Seconds, setTestOneCallEvery1Seconds] = useState<TestConnexionStatus>("not-started");
  const [testOneCallEvery500MS, setTestOneCallEvery500MS] = useState<TestConnexionStatus>("not-started");
  const [testOneCallEvery200MS, setTestOneCallEvery200MS] = useState<TestConnexionStatus>("not-started");
  const [testOneCallEvery100MS, setTestOneCallEvery100MS] = useState<TestConnexionStatus>("not-started");
  const [testOneCallEvery50MS, setTestOneCallEvery50MS] = useState<TestConnexionStatus>("not-started");
  const [testOneCallEvery10MS, setTestOneCallEvery10MS] = useState<TestConnexionStatus>("not-started");

  const responses = useRef<TestConnexionResult[]>([]);

  async function launchTest() {
    setTestLaunched(true);
    responses.current = [];
    setTestOneCallEvery2Seconds("ongoing");
    responses.current.push(await testEvery(2000, 5)); // 10 seconds
    setTestOneCallEvery2Seconds("done");
    setTestOneCallEvery1Seconds("ongoing");
    responses.current.push(await testEvery(1000, 10)); // 10 seconds
    setTestOneCallEvery1Seconds("done");
    setTestOneCallEvery500MS("ongoing");
    responses.current.push(await testEvery(500, 10)); // 5 seconds
    setTestOneCallEvery500MS("done");
    setTestOneCallEvery200MS("ongoing");
    responses.current.push(await testEvery(200, 25)); // 5 seconds
    setTestOneCallEvery200MS("done");
    setTestOneCallEvery100MS("ongoing");
    responses.current.push(await testEvery(100, 10)); // 1 seconds
    setTestOneCallEvery100MS("done");
    setTestOneCallEvery50MS("ongoing");
    responses.current.push(await testEvery(50, 20)); // 1 seconds
    setTestOneCallEvery50MS("done");
    setTestOneCallEvery10MS("ongoing");
    responses.current.push(await testEvery(10, 50)); // 0.5 seconds
    setTestOneCallEvery10MS("done");
    capture(new Error("Test connexion"), {
      extra: { tests: responses.current },
    });
    setTestLaunched(false);
  }

  async function testEvery(intervalMs: number, numberOfTests: number): Promise<TestConnexionResult> {
    const durationsMs: number[] = [];
    const failures: TestConnexionFailureSample[] = [];
    let okCount = 0;
    let failCount = 0;
    const startedAt = new Date().toISOString();

    for (let i = 0; i < numberOfTests; i++) {
      const t0 = performance.now();
      const [error, response] = await tryFetch(async () => API.get({ path: "/check-auth" }));
      const durationMs = Math.round(performance.now() - t0);
      durationsMs.push(durationMs);

      if (error) {
        failCount += 1;
        if (failures.length < 20) {
          failures.push({ index: i + 1, error: error.message, response, durationMs });
        }
      } else {
        okCount += 1;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const endedAt = new Date().toISOString();
    const sorted = [...durationsMs].sort((a, b) => a - b);
    const sum = durationsMs.reduce((acc, v) => acc + v, 0);

    return {
      intervalMs,
      numberOfTests,
      startedAt,
      endedAt,
      okCount,
      failCount,
      avgDurationMs: durationsMs.length ? Math.round(sum / durationsMs.length) : 0,
      p50DurationMs: percentile(sorted, 0.5),
      p95DurationMs: percentile(sorted, 0.95),
      minDurationMs: sorted[0] ?? 0,
      maxDurationMs: sorted[sorted.length - 1] ?? 0,
      failures,
    };
  }

  async function stopTest() {
    if (testLaunched) {
      if (!window.confirm("Êtes-vous sûr de vouloir arrêter le test ?")) return;
      const okCount = responses.current.reduce((acc, r) => acc + (r?.okCount || 0), 0);
      const failCount = responses.current.reduce((acc, r) => acc + (r?.failCount || 0), 0);
      capture(new Error("Test connexion"), {
        extra: { tests: responses.current },
        tags: { okCount, failCount },
        level: "warning",
      });
    }
    setOpen(false);
  }

  async function resetTest() {
    setTestLaunched(false);
    setTestOneCallEvery2Seconds("not-started");
    setTestOneCallEvery1Seconds("not-started");
    setTestOneCallEvery500MS("not-started");
    setTestOneCallEvery200MS("not-started");
    setTestOneCallEvery100MS("not-started");
    setTestOneCallEvery50MS("not-started");
    setTestOneCallEvery10MS("not-started");
  }

  function getTestIcon(status: "done" | "ongoing" | "not-started") {
    switch (status) {
      case "done":
        return "🏁";
      case "ongoing":
        return "🏎️";
      default:
        return "🚥";
    }
  }

  const testIsOver =
    testOneCallEvery2Seconds === "done" &&
    testOneCallEvery1Seconds === "done" &&
    testOneCallEvery500MS === "done" &&
    testOneCallEvery200MS === "done" &&
    testOneCallEvery100MS === "done" &&
    testOneCallEvery50MS === "done" &&
    testOneCallEvery10MS === "done";

  return (
    <>
      <button type="button" className="button-classic" onClick={() => setOpen(true)}>
        Tester ma connexion
      </button>

      <ModalContainer
        open={open}
        onClose={stopTest}
        className="test-connexion"
        size={testLaunched && !testIsOver ? "3xl" : "full"}
        onAfterLeave={resetTest}
      >
        <ModalHeader title="Tester ma connexion" onClose={stopTest} />
        {!testLaunched && !testIsOver ? (
          <>
            <ModalBody className="tw-max-w-prose tw-mx-auto tw-px-4 tw-py-10">
              <p>Vous rencontrez des problèmes de connexion ?</p>
              <p>
                En cliquant sur le bouton ci-dessous, nous allons effectuer quelques tests de votre connexion à nos serveurs, et envoyer les résultats
                à notre équipe technique pour analyse.
              </p>
              <p className="tw-font-bold">Le test dure environ 2 minutes, ne fermez pas cette fenêtre svp !</p>
              <p>Merci de votre patience !</p>
              <button type="button" className="button-classic" onClick={launchTest}>
                Tester ma connexion
              </button>
            </ModalBody>
            <ModalFooter>
              <button type="button" className="button-classic" onClick={stopTest}>
                Annuler
              </button>
              <button type="button" className="button-submit" onClick={launchTest}>
                Tester ma connexion
              </button>
            </ModalFooter>
          </>
        ) : !testIsOver ? (
          <ModalBody className="tw-max-w-prose tw-mx-auto tw-py-10 tw-px-4">
            <ul className="tw-flex-col tw-flex tw-gap-y-2">
              <li>{getTestIcon(testOneCallEvery2Seconds)} Test 1: 1 appel toutes les 2 secondes pendant 10 secondes</li>
              <li>{getTestIcon(testOneCallEvery1Seconds)} Test 2: 1 appel toutes les 1 secondes pendant 10 secondes</li>
              <li>{getTestIcon(testOneCallEvery500MS)} Test 3: 1 appel toutes les 500ms pendant 5 secondes</li>
              <li>{getTestIcon(testOneCallEvery200MS)} Test 4: 1 appel toutes les 200ms pendant 5 secondes</li>
              <li>{getTestIcon(testOneCallEvery100MS)} Test 5: 1 appel toutes les 100ms pendant 1 seconde</li>
              <li>{getTestIcon(testOneCallEvery50MS)} Test 6: 1 appel toutes les 50ms pendant 1 seconde</li>
              <li>{getTestIcon(testOneCallEvery10MS)} Test 7: 1 appel toutes les 10ms pendant 0.5 seconde</li>
            </ul>
          </ModalBody>
        ) : (
          <>
            <ModalBody className="tw-max-w-prose tw-mx-auto tw-py-10 tw-px-4">
              <p>Tests terminés !</p>
              <p>Les résultats ont été envoyés à notre équipe technique pour analyse.</p>
              <p>Merci pour votre patience !</p>
            </ModalBody>
            <ModalFooter>
              <button type="button" className="button-classic" onClick={stopTest}>
                Fermer
              </button>
            </ModalFooter>
          </>
        )}
      </ModalContainer>
    </>
  );
};

export default Account;

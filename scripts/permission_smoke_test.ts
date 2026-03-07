type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  details?: string;
};

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
const sameOrgToken = process.env.TEST_TOKEN_SAME_ORG;
const crossOrgToken = process.env.TEST_TOKEN_CROSS_ORG;
const testBoardId = process.env.TEST_BOARD_ID;
const testOrgId = process.env.TEST_ORG_ID;
const crossOrgId = process.env.TEST_CROSS_ORG_ID;

const checks: CheckResult[] = [];

const expectStatus = async (
  name: string,
  path: string,
  init: RequestInit,
  expected: number[]
) => {
  try {
    const response = await fetch(`${baseUrl}${path}`, init);
    const ok = expected.includes(response.status);
    checks.push({
      name,
      ok,
      status: response.status,
      details: ok ? undefined : `Expected ${expected.join(' or ')}, got ${response.status}`
    });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      details: error instanceof Error ? error.message : 'Unknown request error'
    });
  }
};

const authHeader = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : {};

const run = async () => {
  await expectStatus(
    'Unauthenticated board read should be blocked',
    '/boards/non-existent-id',
    { method: 'GET' },
    [401, 403]
  );

  await expectStatus(
    'Unauthenticated org board list should be blocked',
    '/orgs/non-existent-org/boards',
    { method: 'GET' },
    [401, 403]
  );

  await expectStatus(
    'Unauthenticated org delete should be blocked',
    '/orgs/non-existent-org',
    { method: 'DELETE' },
    [401, 403]
  );

  if (sameOrgToken && testBoardId) {
    await expectStatus(
      'Authenticated same-org board read should succeed',
      `/boards/${encodeURIComponent(testBoardId)}`,
      {
        method: 'GET',
        headers: authHeader(sameOrgToken)
      },
      [200]
    );
  }

  if (crossOrgToken && testBoardId) {
    await expectStatus(
      'Authenticated cross-org board read should be forbidden',
      `/boards/${encodeURIComponent(testBoardId)}`,
      {
        method: 'GET',
        headers: authHeader(crossOrgToken)
      },
      [403]
    );
  }

  if (sameOrgToken && testOrgId && crossOrgId) {
    await expectStatus(
      'Authenticated non-superadmin cross-org org list should be forbidden',
      `/orgs/${encodeURIComponent(crossOrgId)}/boards`,
      {
        method: 'GET',
        headers: authHeader(sameOrgToken)
      },
      [403]
    );

    await expectStatus(
      'Authenticated same-org org list should succeed',
      `/orgs/${encodeURIComponent(testOrgId)}/boards`,
      {
        method: 'GET',
        headers: authHeader(sameOrgToken)
      },
      [200]
    );
  }

  const failed = checks.filter((item) => !item.ok);
  for (const check of checks) {
    const mark = check.ok ? 'PASS' : 'FAIL';
    const suffix = check.status ? ` (status ${check.status})` : '';
    const details = check.details ? ` - ${check.details}` : '';
    console.log(`${mark}: ${check.name}${suffix}${details}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('Permission smoke test crashed:', error);
  process.exitCode = 1;
});

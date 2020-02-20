import { getInput, error, setFailed, setOutput, info } from '@actions/core';
import { GitHub, context } from "@actions/github";
import { runTest } from 'storybook-chromatic/bin/tester/index';
import { verifyOptions } from 'storybook-chromatic/bin/lib/verify-option';

const maybe = (a: string, b: any = undefined) => {
  if(!a) {
    return b;
  }

  try {
    return JSON.parse(a);
  } catch(e){
    return a;
  }
}

const getCommit = (event: typeof context) => {
  switch (event.eventName) {
    case 'pull_request': {
      return {
        // @ts-ignore
        owner: event.payload.repository.owner.login, 
        // @ts-ignore
        repo: event.payload.repository.name,
        // @ts-ignore
        branch: event.payload.pull_request.head.ref,
        // @ts-ignore
        ref: event.ref || event.payload.pull_request.head.ref,
        // @ts-ignore
        sha: event.payload.pull_request.head.sha,
      };
    }
    case 'push': {
      return {
        // @ts-ignore
        owner: event.payload.repository.owner.login, 
        // @ts-ignore
        repo: event.payload.repository.name,
        branch: event.payload.ref.replace('refs/heads/', ''),
        ref: event.payload.ref,
        sha: event.payload.after,
      };
    }
    default: {
      setFailed(event.eventName + ' event is not supported in this action');

      return null;
    };
  }
}

interface Output {
  url: string;
  code: number;
}

async function runChromatic(options): Promise<Output> {
  const { exitCode, exitUrl } = await runTest(await verifyOptions(options));  

  return {
    url: exitUrl,
    code: exitCode,
  };
}

const getApi = () => {
  try {
    const token = getInput('token');
    return new GitHub(token);
  } catch (e){
    setFailed(e.message);

    return null;
  }
}

async function run() {
  const api = getApi();
  const commit = getCommit(context);
  
  if (!api || !commit){
    return;
  }

  const { branch, sha } = commit;

  try {
    const appCode = getInput('appCode');
    const buildScriptName = getInput('buildScriptName');
    const scriptName = getInput('scriptName');
    const exec = getInput('exec');
    const doNotStart = getInput('doNotStart');
    const storybookPort = getInput('storybookPort');
    const storybookUrl = getInput('storybookUrl');
    const storybookBuildDir = getInput('storybookBuildDir');
    const storybookHttps = getInput('storybookHttps');
    const storybookCert = getInput('storybookCert');
    const storybookKey = getInput('storybookKey');
    const storybookCa = getInput('storybookCa');
    const autoAcceptChanges = getInput('autoAcceptChanges');
    const allowConsoleErrors = getInput('allowConsoleErrors');
    const exitZeroOnChanges = getInput('exitZeroOnChanges');
    const exitOnceUploaded = getInput('exitOnceUploaded');
    const ignoreLastBuildOnBranch = getInput('ignoreLastBuildOnBranch');

    process.env.CHROMATIC_SHA = sha;
    process.env.CHROMATIC_BRANCH = branch;

    const chromatic = runChromatic({
      appCode,
      buildScriptName: maybe(buildScriptName),
      scriptName: maybe(scriptName),
      exec: maybe(exec),
      doNotStart: maybe(doNotStart),
      storybookPort: maybe(storybookPort),
      storybookUrl: maybe(storybookUrl),
      storybookBuildDir: maybe(storybookBuildDir),
      storybookHttps: maybe(storybookHttps),
      storybookCert: maybe(storybookCert),
      storybookKey: maybe(storybookKey),
      storybookCa: maybe(storybookCa),
      fromCI: true,
      interactive: false,
      autoAcceptChanges: maybe(autoAcceptChanges),
      exitZeroOnChanges: maybe(exitZeroOnChanges, true),
      exitOnceUploaded: maybe(exitOnceUploaded, false),
      allowConsoleErrors: maybe(allowConsoleErrors, false),
      ignoreLastBuildOnBranch: maybe(ignoreLastBuildOnBranch),
    });

    const [{ url, code }] = await Promise.all([
      chromatic,
    ]);

    setOutput('url', url);
    setOutput('code', code.toString());
  } catch (e) {
    e.message && error(e.message);
    e.stack && error(e.stack);
    e.description && error(e.description);

    setFailed(e.message);
  }
}
run();

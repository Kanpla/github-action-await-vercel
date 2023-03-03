import * as core from '@actions/core';
import axios from 'axios';
import fetch from 'node-fetch';
import querystring from 'querystring';
import { VERCEL_BASE_API_ENDPOINT } from './config';
import { VercelDeployment } from './types/VercelDeployment';

const apiUrl = 'https://api.vercel.com';
const deploymentsUrl = '/v5/now/deployments';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Awaits for the Vercel deployment to be in a "ready" state.
 *
 * @param baseUrl Base url of the Vercel deployment to await for.
 * @param timeout Duration (in seconds) until we'll await for.
 *  When the timeout is reached, the Promise is rejected (the action will fail).
 */
const awaitVercelDeployment = (timeout: number): Promise<VercelDeployment> => {
  return new Promise(async (resolve, reject) => {
    let deployment: VercelDeployment = {};
    const timeoutTime = new Date().getTime() + timeout;

    const token = process.env.VERCEL_TOKEN;
    const githubProject = process.env.GITHUB_REPOSITORY;
    const branch = process.env.BRANCH_NAME;
    const repo = githubProject?.split('/')[1];
    const teamId = process.env.VERCEL_TEAM_ID;
    const projectId = process.env.VERCEL_PROJECT_ID;

    const query = {
      teamId,
      projectId,
    };
    const qs = querystring.stringify(query);

    core.info(`Fetching from: ${apiUrl}${deploymentsUrl}?${qs}`);
    const { data } = await axios.get(`${apiUrl}${deploymentsUrl}?${qs}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    core.debug(`token: ${token}`);
    core.debug(`branch: ${branch}`);
    core.debug(`repo: ${repo}`);

    if (!data || !data.deployments || data.deployments.length <= 0) {
      core.error(JSON.stringify(data, null, 2));
      throw new Error('no deployments found');
    }

    core.debug(`Found ${data.deployments.length} deployments`);
    core.debug(`Looking for matching deployments ${repo}/${branch}`);
    const builds = data.deployments.filter((deployment: VercelDeployment) => {
      return deployment?.meta?.githubCommitRepo === repo && deployment?.meta?.githubCommitRef === branch;
    });

    core.debug(`Found ${builds.length} matching builds`);
    if (!builds || builds.length <= 0) {
      core.error(JSON.stringify(builds, null, 2));
      throw new Error('no deployments found');
    }

    const build = builds[0];
    core.info(`Preview URL: https://${build.url} (${build.state})`);

    const baseUrl = build.url;
    core.debug(`Url to wait for: ${baseUrl}`); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true https://github.com/actions/toolkit/blob/master/docs/action-debugging.md#how-to-access-step-debug-logs

    while (new Date().getTime() < timeoutTime) {
      try {
        deployment = await fetch(`${VERCEL_BASE_API_ENDPOINT}/v11/now/deployments/get?url=${baseUrl}`, {
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
          },
        }).then((data) => data.json());
        core.debug(`Received these data from Vercel: ${JSON.stringify(deployment)}`);

        if (deployment?.readyState === 'READY' || deployment?.readyState === 'ERROR') {
          core.debug('Deployment has been found');
          return resolve(deployment);
        }
      } catch (err) {
        console.log('Fetch vercel err:', err);
      }

      await delay(5000);
    }
    core.debug(`Last deployment response: ${JSON.stringify(deployment)}`);

    return reject('Timeout has been reached');
  });
};

export default awaitVercelDeployment;

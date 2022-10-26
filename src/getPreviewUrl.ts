import * as core from '@actions/core';
import axios from 'axios';
import querystring from 'querystring';
import { VercelDeployment } from './types/VercelDeployment';

const apiUrl = 'https://api.vercel.com';
const deploymentsUrl = '/v5/now/deployments';

/**
 * Awaits for the Vercel deployment to be in a "ready" state.
 *
 * @param baseUrl Base url of the Vercel deployment to await for.
 * @param timeout Duration (in seconds) until we'll await for.
 *  When the timeout is reached, the Promise is rejected (the action will fail).
 */
export const getPreviewUrl = () => {
  return new Promise(async (resolve, reject) => {
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

    const url = build.url;
    return url;
  });
};

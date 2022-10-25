import * as core from '@actions/core';
import fetch from 'node-fetch';
import { VERCEL_BASE_API_ENDPOINT } from './config';
import { VercelDeployment } from './types/VercelDeployment';
import { getPreviewUrl } from './getPreviewUrl';

function delay(ms) {
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

    const baseUrl = await getPreviewUrl();
    core.debug(`Url to wait for: ${baseUrl}`); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true https://github.com/actions/toolkit/blob/master/docs/action-debugging.md#how-to-access-step-debug-logs

    while (new Date().getTime() < timeoutTime) {
      deployment = await fetch(`${VERCEL_BASE_API_ENDPOINT}/v11/now/deployments/get?url=${baseUrl}`, {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        },
      })
        .then((data) => data.json())
        .catch((error: string) => reject(error));
      core.debug(`Received these data from Vercel: ${JSON.stringify(deployment)}`);

      if (deployment?.readyState === 'READY' || deployment?.readyState === 'ERROR') {
        core.debug('Deployment has been found');
        return resolve(deployment);
      }

      await delay(5000);
    }
    core.debug(`Last deployment response: ${JSON.stringify(deployment)}`);

    return reject('Timeout has been reached');
  });
};

export default awaitVercelDeployment;

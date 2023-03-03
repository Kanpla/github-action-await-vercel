"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const axios_1 = __importDefault(require("axios"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const querystring_1 = __importDefault(require("querystring"));
const config_1 = require("./config");
const apiUrl = 'https://api.vercel.com';
const deploymentsUrl = '/v5/now/deployments';
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
const awaitVercelDeployment = (timeout) => {
    return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
        let deployment = {};
        const timeoutTime = new Date().getTime() + timeout;
        const token = process.env.VERCEL_TOKEN;
        const githubProject = process.env.GITHUB_REPOSITORY;
        const branch = process.env.BRANCH_NAME;
        const repo = githubProject === null || githubProject === void 0 ? void 0 : githubProject.split('/')[1];
        const teamId = process.env.VERCEL_TEAM_ID;
        const projectId = process.env.VERCEL_PROJECT_ID;
        const query = {
            teamId,
            projectId,
        };
        const qs = querystring_1.default.stringify(query);
        core.info(`Fetching from: ${apiUrl}${deploymentsUrl}?${qs}`);
        const { data } = yield axios_1.default.get(`${apiUrl}${deploymentsUrl}?${qs}`, {
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
        const builds = data.deployments.filter((deployment) => {
            var _a, _b;
            return ((_a = deployment === null || deployment === void 0 ? void 0 : deployment.meta) === null || _a === void 0 ? void 0 : _a.githubCommitRepo) === repo && ((_b = deployment === null || deployment === void 0 ? void 0 : deployment.meta) === null || _b === void 0 ? void 0 : _b.githubCommitRef) === branch;
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
                deployment = yield node_fetch_1.default(`${config_1.VERCEL_BASE_API_ENDPOINT}/v11/now/deployments/get?url=${baseUrl}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
                    },
                }).then((data) => data.json());
                core.debug(`Received these data from Vercel: ${JSON.stringify(deployment)}`);
                if ((deployment === null || deployment === void 0 ? void 0 : deployment.readyState) === 'READY' || (deployment === null || deployment === void 0 ? void 0 : deployment.readyState) === 'ERROR') {
                    core.debug('Deployment has been found');
                    return resolve(deployment);
                }
            }
            catch (err) {
                console.log('Fetch vercel err:', err);
            }
            yield delay(5000);
        }
        core.debug(`Last deployment response: ${JSON.stringify(deployment)}`);
        return reject('Timeout has been reached');
    }));
};
exports.default = awaitVercelDeployment;

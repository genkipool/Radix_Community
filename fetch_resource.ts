import { apiFetchEntityDetails } from './features/dashboard/services/apiClient';

async function main() {
    try {
        const details = await apiFetchEntityDetails('resource_tdx_2_1t4cu5083yfgm848ud2n720nrm232xca3q2ncy9hes8pcss5rpkdkdk', 'stokenet');
        console.log(JSON.stringify(details.details?.role_assignments, null, 2));
    } catch(e) {
        console.error(e);
    }
}

main();

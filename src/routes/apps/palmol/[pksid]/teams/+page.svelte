<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import type { PageData } from './$types';
    import type { PKSTeam, AppError } from '$lib/types'; // Pastikan AppError sudah diekspor dari $lib/types
    import { Row, Col, Card, CardBody, CardTitle, Button, Alert, Spinner, Badge } from "@sveltestrap/sveltestrap"; // CardText dihapus sementara, akan diganti div
    import Icon from '@iconify/svelte';

    export let data: PageData;

    let pksId: string | undefined = undefined;
    let namaPKS: string | undefined = undefined;
    let teamList: PKSTeam[] = [];
    let messageFromServer: string | undefined | null = undefined;
    let serverError: AppError | null = null; // Diberi tipe AppError atau null

    $: if (data) {
        pksId = data.pksId;
        namaPKS = data.namaPKS;
        teamList = data.teamList || [];
        messageFromServer = data.message;
    }
    $: serverError = $page.error as AppError | null;


    function handleTeamCardClick(teamId: string) {
        if (pksId && teamId) {
            const targetUrl = `/apps/palmol/${pksId}/teams/${teamId}/detail`;
            goto(targetUrl);
        }
    }

    function handleKeyboardActivation(event: KeyboardEvent, teamId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleTeamCardClick(teamId);
        }
    }
</script>

<DefaultLayout {data}>
    <PageBreadcrumb title="Daftar Tim" subTitle={`PKS: ${namaPKS || pksId || 'Tidak Diketahui'}`} />

    <main class="teams-page-main-content pt-3">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3 mb-0 text-dark">Tim di {namaPKS || 'PKS Dipilih'}</h1>
            {#if pksId}
                <Button outline color="secondary" size="sm" href={`/apps/palmol`}>
                    <Icon icon="mdi:arrow-left" class="me-1"/> Kembali ke Daftar PKS
                </Button>
            {/if}
        </div>

        {#if serverError}
            <Alert color="danger" class="shadow-sm">
                <h4 class="alert-heading">
                    <Icon icon="mdi:alert-octagon-outline" class="me-2"/>Terjadi Kesalahan
                </h4>
                <p>
                    Tidak dapat memuat daftar tim.
                    {#if typeof serverError === 'object' && serverError !== null && serverError.message}
                        <br/><small>Detail: {serverError.message}{serverError.status ? ` (${serverError.status})` : ''}</small>
                    {/if}
                </p>
            </Alert>
        {:else if teamList && teamList.length > 0}
            <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-4 teams-grid-container">
                {#each teamList as team (team.id)}
                    <Col class="d-flex align-items-stretch">
                        <div
                            class="team-item-wrapper d-flex flex-column w-100"
                            role="link"
                            tabindex={0}
                            aria-label={`Lihat detail untuk tim ${team.teamName || 'Tanpa Nama'}`}
                            on:click={() => handleTeamCardClick(team.id)}
                            on:keydown={(event) => handleKeyboardActivation(event, team.id)} style="cursor: pointer;"
                        >
                            <Card class="team-item-card h-100 shadow-sm border-light card-hover-lift flex-grow-1">
                                <div class="team-card-visual-header bg-primary bg-gradient text-white d-flex flex-column align-items-center justify-content-center" style="min-height: 100px; border-top-left-radius: var(--bs-card-inner-border-radius); border-top-right-radius: var(--bs-card-inner-border-radius);">
                                    <Icon icon="mdi:account-group-outline" style="font-size: 2.5rem; opacity: 0.8;"/>
                                    <span class="fs-xs text-white-50 mt-1">ID: {team.id.substring(0,6)}...</span>
                                </div>
                                <CardBody class="d-flex flex-column p-3 flex-grow-1">
                                    <h5 class="card-title mb-1 text-dark text-truncate" title={team.teamName || 'Tim Tanpa Nama'}>
                                        {team.teamName || 'Tim Tanpa Nama'}
                                    </h5>
                                    
                                    <div class="mb-2">
                                        {#if team.membersCount > 0}
                                            <Badge color="light" class="text-dark border me-1" pill>
                                                <Icon icon="mdi:account-multiple-outline" class="me-1" style="vertical-align: -1px;"/>
                                                {team.membersCount} Anggota
                                            </Badge>
                                        {:else}
                                            <Badge color="light" class="text-muted border me-1" pill>
                                                <Icon icon="mdi:account-off-outline" class="me-1" style="vertical-align: -1px;"/>
                                                Belum ada anggota
                                            </Badge>
                                        {/if}
                                    </div>

                                    <div class="text-muted small mb-3 flex-grow-1">
                                        <p class="mb-0">
                                            <Icon icon="mdi:calendar-clock-outline" class="me-1" style="vertical-align: -2px;"/>
                                            Laporan Terakhir: <span class="fw-medium">{team.lastReport || 'Belum ada'}</span>
                                        </p>
                                    </div>
                                    
                                    <div class="mt-auto pt-2 border-top">
                                        <Button color="primary" size="sm" outline class="w-100">
                                            Lihat Detail & Laporan <Icon icon="mdi:arrow-right" class="ms-1"/>
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </Col>
                {/each}
            </Row>
        {:else if messageFromServer}
            <Alert color="info" class="shadow-sm text-center status-message info-message">
                <Icon icon="mdi:information-outline" class="me-2" style="font-size: 1.2rem; vertical-align: -3px;"/>
                {messageFromServer}
            </Alert>
        {:else}
            <div class="text-center py-5 status-message">
                <Spinner color="primary" style="width: 3rem; height: 3rem;"/>
                <p class="mt-3 text-muted">Memuat daftar tim Anda...</p>
            </div>
        {/if}
    </main>
</DefaultLayout>

<style>
    .status-message {
        padding: 1rem 1.25rem;
        margin-bottom: 1rem;
        border: 1px solid transparent;
        border-radius: 0.25rem;
        text-align: center;
    }
    
    .fs-xs { 
        font-size: 0.75rem;
    }
</style>
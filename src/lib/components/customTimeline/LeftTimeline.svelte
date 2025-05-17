<script lang="ts">
    import { Badge, Card, CardBody, Col, Row } from "@sveltestrap/sveltestrap";
    import type { TimelineDataType } from "$lib/types";
    import Icon from "@iconify/svelte";

    export let timelineItems: TimelineDataType[] = [];
    export let treeName: string = "Riwayat Pohon";

    // Di LeftTimeline.svelte
    const statusStyles: Record<string, {icon: string, color: string, badgeText: string}> = {
        "sick": { icon: "mdi:virus-off-outline", color: "danger", badgeText: "Sakit"},
        "recovered": { icon: "healthicons:health-outline-24px", color: "success", badgeText: "Pulih"}, // Pakai ikon 'tools' untuk tes
        "maintenance": { icon: "mdi:tools", color: "info", badgeText: "Perawatan"},
        "default": { icon: "mdi:information-outline", color: "secondary", badgeText: "Info"}
    };

    function getStatusStyle(statusTitle: string | undefined) {
        console.log("LeftTimeline getStatusStyle input (event.title):", statusTitle); // DEBUG
        if (!statusTitle) {
            console.log("Returning default style (no title)"); // DEBUG
            return statusStyles["default"];
        }
        const lowerStatusTitle = statusTitle.toLowerCase();
        
        if (statusStyles[lowerStatusTitle]) { // Cek jika event.title adalah key langsung (sick, recovered, maintenance)
            console.log("Matched direct key:", lowerStatusTitle, statusStyles[lowerStatusTitle]); // DEBUG
            return statusStyles[lowerStatusTitle];
        }
        
        if (lowerStatusTitle.includes("sakit") || lowerStatusTitle.includes("ganoderma")) {
            console.log("Matched 'sakit' keyword", statusStyles["sick"]); // DEBUG
            return statusStyles["sick"];
        }
        if (lowerStatusTitle.includes("pulih") || lowerStatusTitle.includes("sehat") || lowerStatusTitle.includes("sembuh")) {
            console.log("Matched 'pulih' keyword", statusStyles["recovered"]); // DEBUG
            return statusStyles["recovered"];
        }
        if (lowerStatusTitle.includes("rawat") || lowerStatusTitle.includes("maintenance")) {
            console.log("Matched 'rawat' keyword", statusStyles["maintenance"]); // DEBUG
            return statusStyles["maintenance"];
        }
        
        console.log("Returning default style (no match)", statusStyles["default"]); // DEBUG
        return statusStyles["default"];
    }
</script>

{#if timelineItems.length > 0}
<Row>
    <Col>
        {#if treeName}
            <h5 class="mb-3 mt-0">{treeName}</h5>
        {/if}
        {#each timelineItems as item (item.date)}
            <div class="d-flex flex-row fs-18 align-items-center mb-2 mt-3">
                <Icon icon="mdi:calendar-month-outline" class="me-2 text-muted fs-5"/>
                <h6 class="mb-0 text-muted">{item.date}</h6>
            </div>
            <ul class="list-unstyled left-timeline ms-3">
                {#each item.events as event (event.title + event.description)}
                    {@const styleInfo = getStatusStyle(event.title)}
                    <li class="left-timeline-list">
                        <Card class="d-inline-block shadow-sm">
                            <CardBody class="py-2 px-3">
                                <div class="d-flex align-items-start">
                                    <div class="me-2 pt-1">
                                        <Icon icon={styleInfo.icon} class="fs-4 text-{styleInfo.color}"/>
                                    </div>
                                    <div>
                                        <h6 class="mt-0 fs-15 mb-1">
                                            {event.title} 
                                            {#if event.badge} 
                                                <Badge color={styleInfo.color || 'secondary'} pill class="ms-2 align-middle" style="font-size: 0.7rem;">
                                                    {event.badge}
                                                </Badge>
                                            {/if}
                                        </h6>
                                        <p class="text-muted mb-1" style="font-size: 0.85rem;">
                                            {event.description}
                                        </p>
                                        {#if event.reportedBy}
                                            <small class="text-muted d-block">
                                                <Icon icon="mdi:account-outline" class="me-1" style="vertical-align: -1px;"/>{event.reportedBy}
                                            </small>
                                        {/if}
                                        {#if event.imageUrl}
                                            <a href={event.imageUrl} target="_blank" class="btn btn-sm btn-link p-0 mt-1" style="font-size: 0.8rem;">
                                                <Icon icon="mdi:image-outline" class="me-1"/>Lihat Foto Record
                                            </a>
                                        {/if}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </li>
                {/each}
            </ul>
        {/each}
    </Col>
</Row>
{:else}
<p class="text-muted text-center my-4">Tidak ada riwayat untuk pohon ini.</p>
{/if}
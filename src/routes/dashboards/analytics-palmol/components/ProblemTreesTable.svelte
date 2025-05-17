<script lang="ts">
    import { Badge, Card, CardHeader, CardTitle, CardBody, Table, Button } from "@sveltestrap/sveltestrap"; // Pastikan CardBody diimpor
    import type { ProblemTree } from "$lib/types";
    import Icon from '@iconify/svelte';

    export let trees: ProblemTree[] = [];
</script>

<Card class="h-100">
    <CardHeader class="d-flex align-items-center justify-content-between">
        <CardTitle class="flex-grow-1 mb-0">
            Pohon Terindikasi Sakit (Update Terbaru)
        </CardTitle>
        {#if trees.length > 0}
        <div>
            <Button size="sm" color="soft-primary" href="/apps/tree-gano">Lihat Semua</Button> 
        </div>
        {/if}
    </CardHeader>

    {#if trees.length > 0}
        <Table hover responsive class="table-nowrap table-centered m-0">
            <thead class="bg-light bg-opacity-50">
                <tr>
                    <th class="text-muted py-2">Nama Pohon</th>
                    <th class="text-muted py-2">Status</th>
                    <th class="text-muted py-2">Tgl Update</th>
                    <th class="text-muted py-2">Pelapor</th>
                    <th class="text-muted py-2">Foto</th>
                </tr>
            </thead>
            <tbody>
                {#each trees as item (item.id)}
                    <tr>
                        <td>
                            <a href={`/monitoring/trees/${item.id}`} class="text-dark fw-medium">{item.name}</a>
                            {#if item.description}
                                <small class="d-block text-muted text-truncate" style="max-width: 200px;">{item.description}</small>
                            {/if}
                        </td>
                        <td>
                            {#if item.last_status === 'sick'}
                                <Badge color="danger" class="rounded-pill px-2 py-1">Sakit</Badge> 
                            {:else if item.last_status === 'healthy'}
                                <Badge color="success" class="rounded-pill px-2 py-1">Sehat</Badge>
                            {:else if item.last_status === 'suspect'}
                                <Badge color="warning" class="rounded-pill px-2 py-1">Suspect</Badge>
                            {:else}
                                <Badge color="secondary" class="rounded-pill px-2 py-1">{item.last_status || 'N/A'}</Badge>
                            {/if}
                        </td>
                        <td>{item.updatedDate}</td>
                        <td class="text-muted">{item.reportedBy}</td>
                        <td>
                            {#if item.img}
                                <a href={item.img} target="_blank" title="Lihat Gambar">
                                    <Icon icon="mdi:image-outline" class="fs-18 text-muted"/>
                                </a>
                            {:else}
                                -
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </Table>
    {:else}
        <CardBody>
            <p class="text-muted text-center my-3">Tidak ada data pohon sakit terbaru.</p>
        </CardBody>
    {/if}
</Card>
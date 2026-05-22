<script lang="ts">
	import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import {
		Row, Col, Card, CardHeader, CardBody, CardTitle,
		Alert, Button, FormGroup, Label, Input, Table, Spinner
	} from '@sveltestrap/sveltestrap';
	import Icon from '@iconify/svelte';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
    import { ToastContainer, toasts } from 'svelte-toasts';
	import Swal from 'sweetalert2';

	export let data: PageData;
	export let form: ActionData;

	let isLoading = false;

	let kawasanInputs = [{ id: Date.now(), value: '' }];

	function addKawasanInput() {
    	kawasanInputs = [...kawasanInputs, { id: Date.now(), value: '' }];
	}

	function removeKawasanInput(id: number) {
    	kawasanInputs = kawasanInputs.filter(item => item.id !== id);
	}

	async function confirmDelete(kawasan: string) {
		const result = await Swal.fire({
			title: `Hapus Kawasan "${kawasan}"?`,
			text: "Tindakan ini tidak dapat dibatalkan. Pohon yang ada di kawasan ini tidak akan terhapus.",
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#6c757d',
			confirmButtonText: 'Ya, Hapus!',
			cancelButtonText: 'Batal'
		});

		if (result.isConfirmed) {
			const deleteForm = document.getElementById(`delete-form-${kawasan}`) as HTMLFormElement;
			if (deleteForm) {
				deleteForm.requestSubmit();
			}
		}
	}
</script>

<ToastContainer />
<DefaultLayout {data}>
	<PageBreadcrumb title="Management Kawasan" subTitle="SawitHarvest" />

	<Row class="mt-3">
		<Col xl="4">
			<Card class="h-100">
				<CardHeader>
					<h4 class="card-title mb-0">Tambah Kawasan Baru</h4>
				</CardHeader>
				<CardBody>
					<form method="POST" action="?/add" use:enhance={() => {
						isLoading = true;
						return async ({ result, update }) => {
							if (result.type === 'success' && result.data?.success) {
								let message = 'Kawasan berhasil ditambahkan!';
								if (result.data && typeof result.data.message === 'string') {
									message = result.data.message;
								}
								toasts.success(message);
								// Reset state input setelah berhasil
								kawasanInputs = [{ id: Date.now(), value: '' }];
							} else if (result.type === 'failure') {
								let message = 'Terjadi kesalahan.';
								if (result.data && typeof result.data.message === 'string') {
									message = result.data.message;
								}
								toasts.error(message);
							}
							await update({ reset: false }); // set reset ke false karena kita handle manual
							isLoading = false;
						};
					}}>
						{#if form?.message && !form?.success}
							<Alert color="danger">{form.message}</Alert>
						{/if}

						<FormGroup>
							<Label for="kawasan-input-0">Nama Kawasan</Label>
							{#each kawasanInputs as input, i (input.id)}
								<div class="d-flex align-items-center mb-2">
									<Input
										id="kawasan-input-{i}"
										name="kawasan"
										type="text"
										placeholder={i === 0 ? "Contoh: Blok A1" : "Kawasan baru..."}
										bind:value={input.value}
										required
									/>
									{#if kawasanInputs.length > 1}
										<Button
											color="danger"
											outline
											class="ms-2 btn-icon"
											title="Hapus baris"
											on:click={() => removeKawasanInput(input.id)}
										>
											<Icon icon="mdi:close" />
										</Button>
									{/if}
								</div>
							{/each}
						</FormGroup>

						<Button
							color="secondary"
							outline
							type="button"
							class="w-100 mb-3"
							size="sm"
							on:click={addKawasanInput}
						>
							<Icon icon="mdi:plus" /> Tambah Baris
						</Button>

						<Button color="primary" type="submit" class="w-100" disabled={isLoading}>
							{#if isLoading}
								<Spinner size="sm" class="me-1" /> Menyimpan...
							{:else}
								<Icon icon="mdi:plus-circle-outline" class="me-1" /> Tambahkan
							{/if}
						</Button>
					</form>
				</CardBody>
			</Card>
		</Col>

		<Col xl="8">
			<Card class="h-100">
				<CardHeader>
					<h4 class="card-title mb-0">Daftar Kawasan Saat Ini</h4>
				</CardHeader>
				<CardBody>
					{#if data.daftarKawasan && data.daftarKawasan.length > 0}
						<div class="table-responsive">
							<Table class="table-sm table-hover align-middle">
								<thead class="table-light">
									<tr>
										<th>Nama Kawasan</th>
										<th class="text-end">Aksi</th>
									</tr>
								</thead>
								<tbody>
									{#each data.daftarKawasan as kawasan (kawasan)}
										<tr>
											<td class="fw-medium">{kawasan}</td>
											<td class="text-end">
												<form
													method="POST"
													action="?/delete"
													id="delete-form-{kawasan}"
													use:enhance={() => {
														return async ({ result, update }) => {
															if (result.type === 'success' && result.data?.success) {
																let message = 'Kawasan berhasil dihapus.';
																if (result.data && typeof result.data.message === 'string') {
																	message = result.data.message;
																}
																toasts.info(message);
															} else if (result.type === 'failure') {
																let message = 'Gagal menghapus kawasan.';
																if (result.data && typeof result.data.message === 'string') {
																	message = result.data.message;
																}
																toasts.error(message);
															}
															await update();
														};
													}}
												>
													<input type="hidden" name="kawasan" value={kawasan} />
													<Button
														type="button"
														color="danger"
														outline
														size="sm"
														class="btn-icon"
														title="Hapus {kawasan}"
														on:click={() => confirmDelete(kawasan)}
													>
														<Icon icon="mdi:trash-can-outline" />
													</Button>
												</form>
											</td>
										</tr>
									{/each}
								</tbody>
							</Table>
						</div>
					{:else}
						<Alert color="info" class="text-center">
							Belum ada kawasan yang ditambahkan. Silakan tambahkan melalui form di samping.
						</Alert>
					{/if}
				</CardBody>
			</Card>
		</Col>
	</Row>
</DefaultLayout>
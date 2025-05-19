<script lang="ts">
	import { Card, CardBody, Row, Col, Alert } from '@sveltestrap/sveltestrap';
	import Icon from '@iconify/svelte';

	export let sickTrees: number;
	export let limit: number;
	export let companyName: string | undefined = undefined; // Opsional nama perusahaan

	// Jika companyName tidak diberikan, gunakan teks generik
	let companyNameToDisplay = companyName || 'Perusahaan Anda';
</script>

<Alert color="danger" class="shadow-lg border-0 ganoderma-warning-panel mb-4 animate__animated animate__pulse">
	<Row class="align-items-center">
		<Col xs="auto" class="text-center" style="font-size: 2.8rem; opacity: 0.7;">
			<Icon icon="mdi:alert-rhombus-outline" />
		</Col>
		<Col>
			<h4 class="alert-heading mb-1" style="font-size: 1.3rem; font-weight: 600;">
				<Icon icon="mdi:virus-variant-outline" class="me-1" style="vertical-align: -3px; font-size: 1.5rem;" />
				PERINGATAN PENYEBARAN GANODERMA!
			</h4>
			<p class="mb-2" style="font-size: 1.05rem;">
				Jumlah pohon yang terindikasi sakit Ganoderma di <strong>{companyNameToDisplay}</strong> telah mencapai
				<strong class="text-danger-emphasis" style="font-size: 1.1em;">{sickTrees} pohon</strong>,
				melebihi batas waspada <strong class="text-danger-emphasis">({limit} pohon)</strong>.
			</p>
			<p class="mb-0" style="font-size: 0.95rem;">
				Segera lakukan tindakan pengendalian intensif dan evaluasi menyeluruh untuk mencegah kerugian lebih lanjut.
				Prioritaskan pemeriksaan dan penanganan pada pohon-pohon yang teridentifikasi.
			</p>
			<hr class="my-2 border-danger-subtle" />
			<p class="mb-0 text-danger-emphasis" style="font-size: 0.85rem;">
				<Icon icon="mdi:information-outline" />
				Konsultasikan dengan ahli agronomi jika diperlukan dan pastikan data monitoring diperbarui secara berkala.
			</p>
		</Col>
	</Row>
</Alert>

<style>
	
	.text-danger-emphasis {
		/* Lebih baik menggunakan variabel Bootstrap jika tersedia atau definisikan sendiri */
		/* Misalnya, jika Bootstrap tidak punya, bisa: color: #a30000 !important; */
		color: var(--bs-danger-text-emphasis) !important;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.02);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
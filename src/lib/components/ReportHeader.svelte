<script lang="ts">
	// Komponen ini tidak lagi memerlukan impor Icon
	export let companyName: string;
	export let reportDate: string;
</script>

<div class="report-header-container">
	<h1>Laporan Analisis Potensi Penyebaran Ganoderma</h1>
	<div class="meta-info">
		<p><span>Perusahaan:</span> {companyName}</p>
		<p><span>Tanggal Laporan Dibuat:</span> {reportDate}</p>
	</div>
</div>

<style>
	.report-header-container {
		font-family: Arial, sans-serif;
		text-align: center;
		color: #333;
		border-bottom: 1px solid #ccc;
		padding-bottom: 1rem;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 18pt;
		font-weight: bold;
		margin: 0 0 0.75rem 0;
	}

	.meta-info {
		font-size: 10pt;
		color: #555;
	}

	.meta-info p {
		margin: 2px 0;
	}

	.meta-info span {
		font-weight: bold;
		margin-right: 8px;
	}
</style>
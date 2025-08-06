<script lang="ts">
	import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	// Impor semua yang dibutuhkan dari Firebase client SDK
	import { db } from '$lib/firebase/client';
	import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
	import {
		collection,
		query,
		orderBy,
		onSnapshot,
		addDoc,
		serverTimestamp,
		doc,
		updateDoc
	} from 'firebase/firestore';
	import { onMount, onDestroy } from 'svelte';
	import { Card, CardBody, Input, Button, Spinner, Progress } from '@sveltestrap/sveltestrap';
	import Icon from '@iconify/svelte';
	import { authStore } from '$lib/stores/authStore';

	export let data;

	let messages: any[] = [];
	let newMessageText = '';
	let isLoading = true;
	let unsubscribeFromMessages: () => void;
	let unsubscribeFromAuth: () => void;

	// Variabel state baru untuk upload
	let isUploading = false;
	let uploadProgress = 0;
	let fileInput: HTMLInputElement;
	
    // Variabel untuk menyimpan data pengguna yang sudah dikonfirmasi
    let confirmedUser: { uid: string; email: string } | null = null;

	onMount(() => {
        // Subscribe ke authStore untuk mendapatkan status login yang pasti
		unsubscribeFromAuth = authStore.subscribe((state) => {
			if (!state.isLoading && state.firebaseUser) {
                // Setelah login terkonfirmasi, simpan data pengguna dan jalankan listener chat
                confirmedUser = { uid: state.firebaseUser.uid, email: state.firebaseUser.email || '' };
				
                console.log('DEBUG - Confirmed Client Auth UID:', confirmedUser.uid);

				if (!unsubscribeFromMessages) {
					const messagesRef = collection(db, 'conversations', data.conversationId, 'messages');
					const q = query(messagesRef, orderBy('timestamp', 'asc'));

					unsubscribeFromMessages = onSnapshot(q, (querySnapshot) => {
						messages = querySnapshot.docs.map((doc) => ({
							id: doc.id,
							...doc.data()
						}));
						isLoading = false;
					}, (error) => {
                        console.error("Error listening to messages:", error);
                        isLoading = false;
                    });
				}
			} else if (!state.isLoading && !state.firebaseUser) {
				isLoading = false;
				console.error('Auth state confirmed: User is not logged in.');
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeFromAuth) unsubscribeFromAuth();
		if (unsubscribeFromMessages) unsubscribeFromMessages();
	});

	async function sendTextMessage() {
		if (newMessageText.trim() === '' || !confirmedUser) return;
		const textToSend = newMessageText;
		newMessageText = '';

		const messagesRef = collection(db, 'conversations', data.conversationId, 'messages');
		await addDoc(messagesRef, {
			senderId: confirmedUser.uid,
			senderName: confirmedUser.email.split('@')[0],
			text: textToSend,
			timestamp: serverTimestamp()
		});

		const convoRef = doc(db, 'conversations', data.conversationId);
		await updateDoc(convoRef, {
			'lastMessage.text': textToSend,
			'lastMessage.senderId': confirmedUser.uid,
			'lastMessage.timestamp': serverTimestamp(),
			unreadByAdmin: true
		});
	}

	function triggerFileUpload() {
		fileInput.click();
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file || !confirmedUser) return;

		if (file.size > 5 * 1024 * 1024) {
			alert('Ukuran file terlalu besar! Maksimal 5MB.');
			return;
		}

		isUploading = true;
		uploadProgress = 0;

		const storage = getStorage();
		const storageRef = ref(storage, `chat_attachments/${data.conversationId}/${Date.now()}-${file.name}`);
		
		const metadata = {
			customMetadata: {
				'uploaderUid': confirmedUser.uid
			}
		};

		const uploadTask = uploadBytesResumable(storageRef, file, metadata);

		uploadTask.on(
			'state_changed',
			(snapshot) => {
				const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
				uploadProgress = progress;
			},
			(error) => {
				console.error('Upload gagal:', error);
				alert('Gagal mengunggah file. Silakan periksa aturan keamanan Storage Anda.');
				isUploading = false;
			},
			async () => {
				const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
				await sendMessageWithAttachment(downloadURL, file.name, file.type);
				isUploading = false;
			}
		);
	}

	async function sendMessageWithAttachment(url: string, name: string, type: string) {
        if (!confirmedUser) return;

		const messagesRef = collection(db, 'conversations', data.conversationId, 'messages');
		await addDoc(messagesRef, {
			senderId: confirmedUser.uid,
			senderName: confirmedUser.email.split('@')[0],
			timestamp: serverTimestamp(),
			downloadUrl: url,
			fileName: name,
			fileType: type
		});
        
        const lastMessageText = type.startsWith('image/') ? 'Mengirim gambar...' : 'Mengirim file...';
		const convoRef = doc(db, 'conversations', data.conversationId);
		await updateDoc(convoRef, {
			'lastMessage.text': lastMessageText,
			'lastMessage.senderId': confirmedUser.uid,
			'lastMessage.timestamp': serverTimestamp(),
			unreadByAdmin: true
		});
	}

	function formatTimestamp(timestamp: any): string {
		if (!timestamp?.toDate) return '';
		return timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<DefaultLayout {data}>
	<PageBreadcrumb title="Chat Bantuan" subTitle="Support" />

	<Card class="mt-3">
		<CardBody>
			<div
				class="chat-window"
				style="height: 60vh; overflow-y: auto; display: flex; flex-direction: column-reverse;"
			>
				<div style="padding: 1rem;">
					{#if isLoading}
						<div class="text-center"><Spinner /></div>
					{:else}
						{#each messages as msg (msg.id)}
							<div
								class="message-bubble"
								class:sent={msg.senderId === confirmedUser?.uid}
								class:received={msg.senderId !== confirmedUser?.uid}
							>
								<div class="sender-name">{msg.senderName}</div>

								{#if msg.text}
									<div class="text">{msg.text}</div>
								{:else if msg.downloadUrl && msg.fileType?.startsWith('image/')}
									<a href={msg.downloadUrl} target="_blank" rel="noopener noreferrer">
										<img src={msg.downloadUrl} alt={msg.fileName} class="chat-image" />
									</a>
								{:else if msg.downloadUrl}
									<a
										href={msg.downloadUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="file-link"
									>
										<Icon icon="mdi:file-document-outline" />
										<span>{msg.fileName || 'Lihat File'}</span>
									</a>
								{/if}

								<div class="timestamp">{formatTimestamp(msg.timestamp)}</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			{#if isUploading}
				<Progress animated value={uploadProgress} class="my-2" style="height: 5px;" />
			{/if}

			<div class="message-input d-flex gap-2 mt-3">
				<input
					type="file"
					bind:this={fileInput}
					on:change={handleFileUpload}
					accept="image/*,video/*,application/pdf"
					style="display: none;"
				/>

				<Button color="light" on:click={triggerFileUpload} disabled={isUploading} title="Kirim File">
					<Icon icon="mdi:paperclip" />
				</Button>
				<Input
					type="text"
					placeholder="Ketik pesan Anda..."
					bind:value={newMessageText}
					on:keydown={(e) => e.key === 'Enter' && sendTextMessage()}
					disabled={isUploading}
				/>
				<Button color="primary" on:click={sendTextMessage} disabled={isUploading}
					><Icon icon="mdi:send" /></Button
				>
			</div>
		</CardBody>
	</Card>
</DefaultLayout>

<style>
	.message-bubble {
		padding: 0.5rem 1rem;
		border-radius: 1rem;
		margin-bottom: 0.5rem;
		max-width: 70%;
		width: fit-content;
		position: relative;
	}
	.sender-name {
		font-size: 0.75rem;
		font-weight: bold;
		margin-bottom: 0.25rem;
	}
	.sent {
		background-color: var(--bs-primary-bg-subtle);
		margin-left: auto;
		border-bottom-right-radius: 0.25rem;
	}
	.received {
		background-color: var(--bs-secondary-bg-subtle);
		margin-right: auto;
		border-bottom-left-radius: 0.25rem;
	}
	.timestamp {
		font-size: 0.7rem;
		color: #6c757d;
		text-align: right;
		margin-top: 4px;
	}
	.chat-image {
		max-width: 100%;
		border-radius: 0.5rem;
		cursor: pointer;
	}
	.file-link {
		display: flex;
		align-items: center;
		padding: 0.5rem;
		background-color: rgba(0, 0, 0, 0.05);
		border-radius: 0.5rem;
		text-decoration: none;
		color: var(--bs-body-color);
	}
	.file-link:hover {
		background-color: rgba(0, 0, 0, 0.1);
	}
	.file-link :global(svg) {
		font-size: 1.5rem;
		margin-right: 0.5rem;
	}
</style>
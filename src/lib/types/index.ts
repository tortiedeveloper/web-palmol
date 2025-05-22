// src/lib/types/index.ts
import type { ApexOptions } from "apexcharts";

// Tipe Umum
export type StatisticCardType = {
    icon: string;
    variant: string;
    title: string;
    statistic: number | string;
    prefix?: string;
    suffix?: string;
};

export interface BaseApexChartOptions extends ApexOptions {
    // Properti kustom jika perlu
}

export interface FirebaseTimestamp {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
}

export interface GeoLocation { // Mengganti nama TreeLocation & UserLocation menjadi lebih generik
    latitude: number;
    longitude: number;
}

export interface FormattedDates { // Untuk field tanggal yang sudah diformat menjadi string
    createdDateFormatted?: string;
    updatedDateFormatted?: string;
}

// Tipe Entitas Firestore (bisa dipakai GanoAI & Ripeness dengan field opsional)
export interface Company {
    id: string;
    company_name: string;
    consultationId?: string; // Spesifik GanoAI? Jadikan opsional
    isCompany?: boolean;
    onRequest?: boolean;     // Spesifik GanoAI? Jadikan opsional
}

export interface TreeDate { // Tetap menggunakan string karena sudah diserialisasi dari server
    createdDate: string | null;
    updatedDate: string | null;
}

// Field baru khusus untuk Ripeness
export interface FruitCounts {
    belumMatang: number;
    matang: number;
    terlaluMatang: number;
}

export interface Tree extends FormattedDates { // Gabungkan FormattedDates
    id: string;
    companyId: string;
    name: string;
    description?: string;
    img?: string;
    last_status?: "sick" | "recovered" | "maintenance" | string; // Status untuk GanoAI
    location?: GeoLocation;
    date?: TreeDate; // Berisi string tanggal ISO setelah serialisasi
    userId?: string;
    userName?: string;
    fruitCounts?: FruitCounts; // Opsional, untuk Ripeness
}

export interface UserDateInfo {
    validDate?: string | null;
    createdDate?: string | null; // TAMBAHKAN
    updatedDate?: string | null; // TAMBAHKAN
}

export interface User extends FormattedDates { // Gabungkan FormattedDates jika User punya created/updated
    userId: string;
    id: string;
    name: string;
    email: string;
    companyId: string; // Bisa jadi companyId GanoAI atau Ripeness, tergantung konteks
    avatar?: string;
    phoneNumber?: string;
    address?: string;
    androidId?: string;
    birthDate?: string;
    date?: UserDateInfo; // Map 'date' dari Firestore (sudah diserialisasi)
    fcmToken?: string;
    gender?: string;
    idToken?: string;
    lastUpdated?: string | null; // Sudah disesuaikan untuk serialisasi
    location?: GeoLocation;
    membership?: string; // 'regular', 'premium' di GanoAI companyUser
    type?: "user" | string;

    pksId?: string;
    pksName?: string; 
    role?: string;
}

export interface CompanyUser {
    id: string; // Firebase Auth UID
    companyId: string; // ID perusahaan di sistem terkait (GanoAI atau Ripeness)
    email: string;
    avatar?: string;
    membership?: string; // Field 'membership' ada di GanoAI, mungkin juga ada di Ripeness?
}

// Tipe untuk Data Peta
export interface TreeGeoJSONProperties {
    id: string;
    name: string;
    last_status?: "sick" | "recovered" | "maintenance" | string; // Status GanoAI
    fruitCounts?: FruitCounts; // Untuk Ripeness, ditampilkan di popup
    img?: string;
    description?: string;
}

// Tipe untuk Riwayat/Record Pohon
export interface TreeRecord extends FormattedDates { // Gabungkan FormattedDates
    id: string;
    companyId: string;
    treeId: string;
    date?: TreeDate; // Berisi string tanggal ISO setelah serialisasi
    description?: string;
    img?: string;
    location?: GeoLocation;
    status?: "sick" | "recovered" | "maintenance" | string; // Status GanoAI atau status umum record
    fruitCounts?: FruitCounts; // Untuk record di Ripeness
    userId?: string;
    userName?: string;
}

// Tipe untuk Timeline
export interface TimelineEventType {
    side?: 'left' | 'right';
    title: string;
    badge?: string;
    description: string;
    imageUrl?: string;
    reportedBy?: string;
    originalDateISO?: string;
}

export interface TimelineDataType {
    date: string;
    events: TimelineEventType[];
}

export interface PKSRawDates { // Atau nama apa pun yang Anda gunakan, misal TreeDate
    createdDate: string | null;     // UBAH DARI FirebaseTimestamp menjadi string | null
    updatedDate: string | null;     // UBAH DARI FirebaseTimestamp menjadi string | null
    validDate?: string | null;    // UBAH DARI FirebaseTimestamp menjadi string | null (jika opsional)
}

// Tipe untuk Menu (dari template Anda)
export type MenuItemType = { /* ... definisi MenuItemType Anda ... */
    key: string;
    label: string;
    isTitle?: boolean;
    icon?: string;
    url?: string;
    badge?: { variant: string; text: string; };
    parentKey?: string;
    target?: string;
    disabled?: boolean;
    children?: MenuItemType[];
};
export type SubMenus = { /* ... definisi SubMenus Anda ... */
    item: MenuItemType;
    linkClassName?: string;
    subMenuClassName?: string;
    activeMenuItems?: Array<string>;
    toggleMenu?: (item: MenuItemType, status: boolean) => void;
    className?: string;
};


// Tipe untuk Store Layout (sesuaikan dengan store Anda)
export interface LayoutStoreState {
    leftSideBarSize: 'sm-hover-active' | 'sm-hover' | 'hidden' | 'condensed' | 'default' | string;
    theme: 'light' | 'dark';
    // Tambahkan properti lain dari store layout Anda jika ada, pastikan namanya SAMA PERSIS
    // topBarColor?: string; 
    // leftSideBarColor?: string; 
}

// Tipe untuk Data Tabel di Halaman Analytics
export interface ProblemTree { // Untuk GanoAI
    id: string;
    name: string;
    last_status: string;
    updatedDate: string;
    reportedBy?: string;
    img?: string;
    description?: string;
}

export interface HarvestReadyTree { // Untuk Ripeness
    id: string;
    name: string;
    fruitCounts: FruitCounts; // Wajib ada di sini
    updatedDate: string;
    reportedBy?: string;
    img?: string; // Opsional
}

// Tipe untuk Data Session Pengguna
export interface UserSessionData {
    email: string;
    avatar?: string;

    ganoAIUserId?: string;
    ganoAICompanyId?: string;
    hasGanoAIAccess: boolean;
    isGanoAIPremium?: boolean;

    ripenessUserId?: string;
    ripenessCompanyId?: string;
    hasRipenessAccess: boolean;

    accountActive?: boolean;
}

// Tipe untuk Item Menu di TopBar
export interface TopBarProfileItem {
    key: string;
    label: string;
    isHeader?: boolean;
    url?: string;
    icon?: string;
    action?: () => void;
}

// Tipe untuk data chart spesifik Ripeness (jika berbeda dari GanoAI)
export interface RipenessMonthlyData {
    month: string;
    totalMatang: number;
    // bisa ditambahkan: totalBelumMatang, totalTerlaluMatang jika ingin di-trend-kan
}

export interface RipenessFruitCompositionData {
    series: number[];
    labels: string[];
}

export interface RipenessFruitTrendData {
    categories: string[];
    series: { name: string; type?: 'line' | 'bar' | 'area'; data: number[] }[];
}

export interface PKS extends FormattedDates {
    id: string; // ID Dokumen Firestore (akan diisi dengan ID PKS dari field pksId jika ada)
    pksId: string; // Field pksId dari dalam dokumen (ID unik PKS sebenarnya)
    companyId: string; // Penting untuk filter
    pksName: string;
    address?: string;
    avatar?: string;
    email?: string;
    phoneNumber?: string;
    location?: GeoLocation;
    membership?: string;
    date?: PKSRawDates;
}

export interface PKSTeam {
    id: string; // ID Dokumen Firestore untuk team
    teamName: string;
    membersCount: number; // Kita hitung dari array members
    membersIdList?: string[]; // Array User ID (dari PKSUsers)
    populatedMembersList?: PopulatedMemberInfo[];
    lastReport?: string; // Tanggal string yang sudah diformat
    // Field date mentah jika perlu
    originalLastReport?: string | null; 
}

export interface PopulatedMemberInfo { // Buat tipe ini jika belum ada
    id: string;
    name: string;
    avatar?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
}

export interface PKSUser extends User { // Bisa meng-extend tipe User utama jika fieldnya banyak yang sama
    pksId: string; // ID PKS tempat user ini bekerja (jika relevan)
    teamId?: string; // ID Team tempat user ini tergabung (jika relevan)
    // Field spesifik PKSUser lainnya
}

// src/lib/types/index.ts
export interface PKSReport {
  id: string;
  date: string; // Tanggal string yang sudah diformat
  originalDate?: string | null; // PERBAIKAN TIPE: string ISO atau null
  img?: string | null;
  jumlahBerat: number;
  userId: string; 
  userName?: string; 
  teamId: string;
  teamName?: string; // Akan diisi
  pksId: string;    // ID PKS asal laporan
  pksName?: string;  // Akan diisi
}

export interface AppError { // Anda bisa membuatnya lebih spesifik jika tahu struktur error dari $page.error
    message: string;
    status?: number; // status bisa jadi opsional atau selalu ada tergantung bagaimana Anda set $page.error
    // tambahkan properti lain jika ada
}

export interface TopPerformer {
    id: string; // Bisa ID Tim atau ID User, tergantung konteks
    name: string; // Nama Tim (PKS) atau Nama Pelapor
    totalBerat: number;
    reportCount: number; // Konsisten menggunakan reportCount
    avgBeratPerReport: number;
    pksName?: string; // Opsional, untuk konteks PKS pada tim jika perlu
}
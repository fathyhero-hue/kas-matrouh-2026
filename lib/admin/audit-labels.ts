/**
 * Presentation-only labels for audit data. Stored action/resource values stay
 * technical so filters, API contracts, and existing audit rows remain stable.
 */

const ACTION_LABELS: Record<string, string> = {
  "admins.create": "إضافة مسؤول جديد",
  "admins.edit": "تعديل بيانات مسؤول",
  "admins.role.change": "تغيير دور مسؤول",
  "admins.enable": "تفعيل حساب مسؤول",
  "admins.activate": "تفعيل حساب مسؤول",
  "admins.disable": "تعطيل حساب مسؤول",
  "admins.deactivate": "تعطيل حساب مسؤول",
  "admins.permissions.change": "تعديل صلاحيات مسؤول",
  "admins.password.reset": "إعادة تعيين كلمة مرور مسؤول",
  "admins.reset_password": "إعادة تعيين كلمة مرور مسؤول",
  "app_settings.mutation": "تعديل إعدادات النظام",
  "banned_entities.mutation": "تعديل قائمة الحظر",
  "elite_registration.cash_payment.confirm": "تأكيد الدفع النقدي للتسجيل",
  "formations.mutation": "تعديل التشكيلات",
  "matches.mutation": "تعديل المباريات",
  "match.create": "إضافة مباراة",
  "match.update": "تعديل مباراة",
  "match.delete": "حذف مباراة",
  "media.mutation": "تعديل المحتوى الإعلامي",
  "orders.mutation": "تعديل الطلبات والمدفوعات",
  "player_cards.create": "إنشاء بطاقة لاعب",
  "player_cards.update": "تعديل بطاقة لاعب",
  "player_cards.bulk_create": "إنشاء بطاقات لاعبين دفعة واحدة",
  "player_registration_tournaments.mutation": "تعديل بطولات تسجيل اللاعبين",
  "player_registrations.mutation": "تعديل تسجيلات اللاعبين",
  "registration_settings.mutation": "تعديل إعدادات التسجيل",
  "rosters.mutation": "تعديل قوائم الفرق",
  "roster.create": "إنشاء قائمة فريق",
  "roster.update": "تعديل قائمة فريق",
  "roster.submit": "تقديم قائمة فريق",
  "shop_products.mutation": "تعديل منتجات المتجر",
  "stats.mutation": "تعديل الإحصائيات",
  "storage.mutation": "رفع ملف إلى التخزين",
  "cash_payment.confirm": "تأكيد دفع نقدي",
  "result.update": "تحديث نتيجة مباراة",
  "role.update": "تعديل دور إداري",
  "permission.update": "تعديل صلاحية",
  "admin.create": "إضافة مسؤول جديد",
  "admin.update": "تعديل بيانات مسؤول",
  "admin.activate": "تفعيل حساب مسؤول",
  "admin.deactivate": "تعطيل حساب مسؤول",
};

const RESOURCE_LABELS: Record<string, string> = {
  admin_profile: "المسؤولون",
  admins: "المسؤولون",
  app_settings: "الإعدادات",
  banned_entities: "قائمة الحظر",
  formations: "التشكيلات",
  matches: "المباريات",
  media: "المحتوى الإعلامي",
  orders: "الطلبات والمدفوعات",
  player_cards: "بطاقات اللاعبين",
  player_registration_tournaments: "بطولات تسجيل اللاعبين",
  player_registrations: "تسجيلات اللاعبين",
  registration_settings: "إعدادات التسجيل",
  rosters: "قوائم الفرق",
  team_rosters: "قوائم الفرق",
  shop_products: "منتجات المتجر",
  stats: "الإحصائيات",
  storage: "التخزين والملفات",
  players: "اللاعبون",
  registrations: "التسجيلات",
  payments: "المدفوعات",
  settings: "الإعدادات",
};

const STATUS_LABELS: Record<string, string> = {
  success: "ناجحة",
  failed: "فاشلة",
  allowed: "مسموح",
  denied: "مرفوض",
  active: "نشطة",
  inactive: "غير نشطة",
  enabled: "مفعّلة",
  disabled: "معطّلة",
  ready: "جاهزة",
  draft: "مسودة",
  needs_update: "تحتاج إلى تحديث",
  archived: "مؤرشفة",
  pending: "قيد الانتظار",
  paid: "مدفوعة",
  unpaid: "غير مدفوعة",
  manual_access: "تفعيل يدوي",
  cancelled: "ملغاة",
  confirmed: "مؤكدة",
  rejected: "مرفوضة",
};

const DETAIL_LABELS: Record<string, string> = {
  display_name: "الاسم المعروض",
  role_key: "الدور الإداري",
  is_active: "حالة التفعيل",
  allow: "السماح",
  deny: "الرفض",
  inherit: "الوراثة",
  card_number: "رقم البطاقة",
  payment_status: "حالة الدفع",
  payment_method: "طريقة الدفع",
  paid_at: "وقت الدفع",
  confirmed_by: "تم التأكيد بواسطة",
  team_slug: "الفريق",
  match_id: "المباراة",
  old_status: "الحالة السابقة",
  new_status: "الحالة الجديدة",
};

const PERMISSION_LABELS: Record<string, string> = {
  "matches.view": "عرض المباريات",
  "matches.create": "إضافة المباريات",
  "matches.edit": "تعديل المباريات",
  "matches.delete": "حذف المباريات",
  "matches.schedule.manage": "إدارة مواعيد المباريات",
  "matches.live.manage": "إدارة المباريات المباشرة",
  "matches.results.manage": "إدارة نتائج المباريات",
  "rosters.view": "عرض قوائم الفرق",
  "rosters.create": "إنشاء قوائم الفرق",
  "rosters.edit": "تعديل قوائم الفرق",
  "rosters.delete": "حذف قوائم الفرق",
  "rosters.approve": "اعتماد قوائم الفرق",
  "rosters.players.manage": "إدارة لاعبي القوائم",
  "rosters.settings.manage": "إدارة إعدادات التسجيل",
  "registrations.view": "عرض التسجيلات",
  "registrations.edit": "تعديل التسجيلات",
  "registrations.delete": "حذف التسجيلات",
  "shop.products.manage": "إدارة منتجات المتجر",
  "shop.orders.manage": "إدارة طلبات المتجر",
  "shop.orders.financial.manage": "إدارة مدفوعات المتجر",
  "content.edit": "تعديل المحتوى",
  "notifications.send": "إرسال الإشعارات",
  "stats.goals.manage": "إدارة أهداف الإحصائيات",
  "stats.formations.manage": "إدارة التشكيلات",
  "stats.photos.upload": "رفع صور الإحصائيات",
  "tournaments.groups.manage": "إدارة مجموعات البطولات",
  "admins.create": "إضافة المسؤولين",
  "admins.edit": "تعديل المسؤولين",
  "admins.disable": "تعطيل المسؤولين",
  "admins.reset_password": "إعادة تعيين كلمات المرور",
  "admins.permissions.manage": "إدارة صلاحيات المسؤولين",
};

export const AUDIT_ACTION_OPTIONS = [
  "admins.create", "admins.edit", "admins.role.change", "admins.enable", "admins.disable",
  "admins.permissions.change", "admins.password.reset", "admins.reset_password", "app_settings.mutation",
  "banned_entities.mutation", "elite_registration.cash_payment.confirm", "formations.mutation",
  "matches.mutation", "media.mutation", "orders.mutation", "player_cards.create",
  "player_cards.update", "player_cards.bulk_create", "player_registration_tournaments.mutation",
  "player_registrations.mutation", "registration_settings.mutation", "rosters.mutation",
  "shop_products.mutation", "stats.mutation", "storage.mutation",
].map((value) => ({ value, label: ACTION_LABELS[value] }));

function humanizeTechnicalKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAuditActionLabel(action: string | null | undefined): string {
  const value = String(action ?? "").trim();
  if (!value) return "حركة غير معروفة";
  return ACTION_LABELS[value] ?? `حركة إدارية (${value})`;
}

export function getAuditResourceLabel(resource: string | null | undefined): string {
  const value = String(resource ?? "").trim();
  if (!value) return "غير محدد";
  return RESOURCE_LABELS[value] ?? `قسم إداري (${humanizeTechnicalKey(value)})`;
}

export function getAuditStatusLabel(status: string | null | undefined): string {
  const value = String(status ?? "").trim();
  if (!value) return "غير محددة";
  return STATUS_LABELS[value] ?? `حالة (${humanizeTechnicalKey(value)})`;
}

export function getAuditDetailLabel(detail: string | null | undefined): string {
  const value = String(detail ?? "").trim();
  if (!value) return "تفصيل غير معروف";
  if (PERMISSION_LABELS[value]) return PERMISSION_LABELS[value];
  return DETAIL_LABELS[value] ?? `تفصيل (${humanizeTechnicalKey(value)})`;
}

export function isKnownAuditAction(action: string | null | undefined): boolean {
  return typeof action === "string" && action in ACTION_LABELS;
}

export type AuditDisplayMetadata = {
  changed_fields?: string[];
  old_status?: string;
  new_status?: string;
  team_slug?: string;
  match_id?: string;
};

export function formatAuditDetails(metadata: AuditDisplayMetadata | null | undefined): string[] {
  if (!metadata) return [];
  const details: string[] = [];
  if (metadata.changed_fields?.length) {
    details.push(`الحقول: ${metadata.changed_fields.map(getAuditDetailLabel).join("، ")}`);
  }
  if (metadata.old_status) details.push(`${getAuditDetailLabel("old_status")}: ${getAuditStatusLabel(metadata.old_status)}`);
  if (metadata.new_status) details.push(`${getAuditDetailLabel("new_status")}: ${getAuditStatusLabel(metadata.new_status)}`);
  if (metadata.team_slug) details.push(`${getAuditDetailLabel("team_slug")}: ${metadata.team_slug}`);
  if (metadata.match_id) details.push(`${getAuditDetailLabel("match_id")}: ${metadata.match_id}`);
  return details;
}

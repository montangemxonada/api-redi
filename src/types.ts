export type LinkRow = {
  id: string;
  user_id: string;
  slug: string;
  target_url: string;
  title: string | null;
  note: string | null;
  preview_image: string | null;

  requires_auth: boolean;
  password_hash: string | null;

  one_time: boolean;
  click_limit: number | null;
  click_count: number;

  expires_at: string | null; // ISO
  active: boolean;

  created_at: string;
  updated_at: string;
};

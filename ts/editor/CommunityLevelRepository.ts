import { supabase } from "../database/supabase";
import type { UserLevelDraft, UserLevelRow } from "./CommunityLevelTypes";
import { normalizeUserLevel } from "./CommunityLevelTypes";

const USER_LEVEL_TABLE = "user_levels";

export class CommunityLevelRepository {
    async listOwnedLevels(ownerId: string): Promise<UserLevelDraft[]> {
        const { data, error } = await supabase
            .from(USER_LEVEL_TABLE)
            .select("id, owner_id, title, name, level_data, data, published, updated_at")
            .eq("owner_id", ownerId)
            .order("updated_at", { ascending: false });
        if (error) throw error;
        return ((data ?? []) as UserLevelRow[]).map(normalizeUserLevel);
    }

    async getLevel(id: string, ownerId: string): Promise<UserLevelDraft> {
        const { data, error } = await supabase
            .from(USER_LEVEL_TABLE)
            .select("id, owner_id, title, name, level_data, data, published, updated_at")
            .eq("id", id)
            .eq("owner_id", ownerId)
            .single();
        if (error) throw error;
        return normalizeUserLevel(data as UserLevelRow);
    }

    async saveLevel(level: UserLevelDraft): Promise<UserLevelDraft> {
        const payload = {
            owner_id: level.ownerId,
            title: level.title,
            level_data: { ...level.document, title: level.title },
            published: level.published
        };
        const query = level.id
            ? supabase.from(USER_LEVEL_TABLE).update(payload).eq("id", level.id).eq("owner_id", level.ownerId).select().single()
            : supabase.from(USER_LEVEL_TABLE).insert(payload).select().single();
        const { data, error } = await query;
        if (error) throw error;
        return normalizeUserLevel(data as UserLevelRow);
    }

    async deleteLevel(id: string, ownerId: string): Promise<void> {
        const { error } = await supabase.from(USER_LEVEL_TABLE).delete().eq("id", id).eq("owner_id", ownerId);
        if (error) throw error;
    }
}
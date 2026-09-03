import { v4 as uuid } from "uuid";
import { supabase } from "../config/supabase.js";
export class StorageService {
    static async uploadMenuImage(file) {
        const extension = file.originalname.split(".").pop();
        const fileName = `menu/${uuid()}.${extension}`;
        const { error } = await supabase.storage
            .from("menus")
            .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });
        if (error) {
            throw new Error(error.message);
        }
        const { data: { publicUrl }, } = supabase.storage.from("menus").getPublicUrl(fileName);
        return publicUrl;
    }
}

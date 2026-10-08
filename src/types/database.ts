export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_same_owner_fk"
            columns: ["parent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      mistake_logs: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          meaning: string
          resolved: boolean
          resolved_at: string | null
          user_answer: string
          user_id: string
          vocabulary_id: string | null
          word: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          id?: string
          meaning: string
          resolved?: boolean
          resolved_at?: string | null
          user_answer: string
          user_id: string
          vocabulary_id?: string | null
          word: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          meaning?: string
          resolved?: boolean
          resolved_at?: string | null
          user_answer?: string
          user_id?: string
          vocabulary_id?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "mistake_logs_vocabulary_same_owner_fk"
            columns: ["vocabulary_id", "user_id"]
            isOneToOne: false
            referencedRelation: "vocabularies"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quiz_result_folders: {
        Row: {
          folder_id: string
          quiz_result_id: string
          user_id: string
        }
        Insert: {
          folder_id: string
          quiz_result_id: string
          user_id: string
        }
        Update: {
          folder_id?: string
          quiz_result_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_result_folders_folder_same_owner_fk"
            columns: ["folder_id", "user_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "quiz_result_folders_result_same_owner_fk"
            columns: ["quiz_result_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          score_percent: number
          total_questions: number
          user_id: string
          wrong_count: number
        }
        Insert: {
          correct_count: number
          created_at?: string
          id?: string
          score_percent: number
          total_questions: number
          user_id: string
          wrong_count: number
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          score_percent?: number
          total_questions?: number
          user_id?: string
          wrong_count?: number
        }
        Relationships: []
      }
      review_logs: {
        Row: {
          id: string
          rating: Database["public"]["Enums"]["review_rating"]
          reviewed_at: string
          user_id: string
          vocabulary_id: string
        }
        Insert: {
          id?: string
          rating: Database["public"]["Enums"]["review_rating"]
          reviewed_at?: string
          user_id: string
          vocabulary_id: string
        }
        Update: {
          id?: string
          rating?: Database["public"]["Enums"]["review_rating"]
          reviewed_at?: string
          user_id?: string
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_vocabulary_same_owner_fk"
            columns: ["vocabulary_id", "user_id"]
            isOneToOne: false
            referencedRelation: "vocabularies"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          current_index: number
          id: string
          rating_counts: Json
          updated_at: string
          user_id: string
          vocabulary_ids: string[]
        }
        Insert: {
          created_at?: string
          current_index?: number
          id?: string
          rating_counts?: Json
          updated_at?: string
          user_id: string
          vocabulary_ids: string[]
        }
        Update: {
          created_at?: string
          current_index?: number
          id?: string
          rating_counts?: Json
          updated_at?: string
          user_id?: string
          vocabulary_ids?: string[]
        }
        Relationships: []
      }
      vocabularies: {
        Row: {
          created_at: string
          ease_factor: number
          example: string
          folder_id: string | null
          id: string
          interval_days: number
          last_reviewed_at: string | null
          level: string
          meaning: string
          next_review_at: string
          phonetic: string
          repetitions: number
          status: Database["public"]["Enums"]["vocab_status"]
          updated_at: string
          user_id: string
          word: string
          word_type: Database["public"]["Enums"]["word_type"]
        }
        Insert: {
          created_at?: string
          ease_factor?: number
          example?: string
          folder_id?: string | null
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          level?: string
          meaning: string
          next_review_at?: string
          phonetic?: string
          repetitions?: number
          status?: Database["public"]["Enums"]["vocab_status"]
          updated_at?: string
          user_id: string
          word: string
          word_type?: Database["public"]["Enums"]["word_type"]
        }
        Update: {
          created_at?: string
          ease_factor?: number
          example?: string
          folder_id?: string | null
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          level?: string
          meaning?: string
          next_review_at?: string
          phonetic?: string
          repetitions?: number
          status?: Database["public"]["Enums"]["vocab_status"]
          updated_at?: string
          user_id?: string
          word?: string
          word_type?: Database["public"]["Enums"]["word_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vocabularies_folder_same_owner_fk"
            columns: ["folder_id", "user_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_quiz_attempt: {
        Args: {
          p_correct_count: number
          p_folder_ids?: string[]
          p_mistakes?: Json
          p_score_percent: number
          p_total_questions: number
          p_wrong_count: number
        }
        Returns: {
          correct_count: number
          created_at: string
          id: string
          score_percent: number
          total_questions: number
          user_id: string
          wrong_count: number
        }
        SetofOptions: {
          from: "*"
          to: "quiz_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_vocabulary_review: {
        Args: {
          p_rating: Database["public"]["Enums"]["review_rating"]
          p_vocabulary_id: string
        }
        Returns: {
          created_at: string
          ease_factor: number
          example: string
          folder_id: string | null
          id: string
          interval_days: number
          last_reviewed_at: string | null
          level: string
          meaning: string
          next_review_at: string
          phonetic: string
          repetitions: number
          status: Database["public"]["Enums"]["vocab_status"]
          updated_at: string
          user_id: string
          word: string
          word_type: Database["public"]["Enums"]["word_type"]
        }
        SetofOptions: {
          from: "*"
          to: "vocabularies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_study_session: {
        Args: { p_vocabulary_ids: string[] }
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"]
        SetofOptions: {
          from: "study_sessions"
          to: "study_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_study_session_review: {
        Args: {
          p_rating: Database["public"]["Enums"]["review_rating"]
          p_session_id: string
          p_vocabulary_id: string
        }
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"]
        SetofOptions: {
          from: "study_sessions"
          to: "study_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      review_rating: "forgot" | "hard" | "good" | "easy"
      vocab_status: "new" | "learning" | "mastered"
      word_type:
        | "noun"
        | "verb"
        | "adjective"
        | "adverb"
        | "phrase"
        | "idiom"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      review_rating: ["forgot", "hard", "good", "easy"],
      vocab_status: ["new", "learning", "mastered"],
      word_type: [
        "noun",
        "verb",
        "adjective",
        "adverb",
        "phrase",
        "idiom",
        "other",
      ],
    },
  },
} as const

import { supabase } from '../lib/supabase';

export interface DbMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface SendMessageResult {
  success: boolean;
  message?: DbMessage;
  error?: string;
}

class ChatService {
  /**
   * Fetch complete message history between the authenticated user and their linked partner.
   */
  public async fetchConversation(partnerId: string): Promise<{
    success: boolean;
    messages: DbMessage[];
    error?: string;
  }> {
    if (!partnerId) {
      return { success: false, messages: [], error: 'Partner ID is required.' };
    }

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.user) {
        return { success: false, messages: [], error: 'You must be signed in to view messages.' };
      }

      const currentUserId = sessionData.session.user.id;

      // Fetch messages exchanged strictly between current user and partner in chronological order
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, message, is_read, created_at')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ChatService] Error fetching messages:', error);
        return { success: false, messages: [], error: error.message };
      }

      return { success: true, messages: data || [] };
    } catch (err: any) {
      console.error('[ChatService] Exception fetching conversation:', err);
      return { success: false, messages: [], error: err.message || 'Failed to load conversation history.' };
    }
  }

  /**
   * Send a new message to the linked partner.
   */
  public async sendMessage(partnerId: string, text: string): Promise<SendMessageResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { success: false, error: 'Message cannot be empty.' };
    }

    if (!partnerId) {
      return { success: false, error: 'Recipient ID is missing.' };
    }

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.user) {
        return { success: false, error: 'Your session has expired. Please sign in again.' };
      }

      const currentUserId = sessionData.session.user.id;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: partnerId,
          message: trimmed,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('[ChatService] Error sending message:', error);
        return { success: false, error: error.message || 'Failed to send message.' };
      }

      return { success: true, message: data as DbMessage };
    } catch (err: any) {
      console.error('[ChatService] Exception sending message:', err);
      return { success: false, error: err.message || 'Network error while sending message.' };
    }
  }

  /**
   * Subscribe to incoming messages between current user and partner in real time via Supabase Realtime.
   * Returns an unsubscribe cleanup callback.
   */
  public subscribeToConversation(
    currentUserId: string,
    partnerId: string,
    onNewMessage: (msg: DbMessage) => void
  ): () => void {
    if (!currentUserId || !partnerId) {
      return () => {};
    }

    // Unique channel identifier scoped to this exact conversation pair
    const pairKey = [currentUserId, partnerId].sort().join('-');
    const channelName = `realtime:messages:${pairKey}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as DbMessage;
          if (!newMsg) return;

          // Only forward messages that belong strictly to this pair
          const isRelevant =
            (newMsg.sender_id === partnerId && newMsg.receiver_id === currentUserId) ||
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === partnerId);

          if (isRelevant) {
            onNewMessage(newMsg);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[ChatService] Subscribed to real-time chat for pair ${pairKey}`);
        }
      });

    return () => {
      console.log(`[ChatService] Cleaning up chat subscription ${channelName}`);
      supabase.removeChannel(channel);
    };
  }

  /**
   * Mark unread messages sent by partner to current user as read.
   */
  public async markAsRead(partnerId: string): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      if (!currentUserId || !partnerId) return;

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);
    } catch (err) {
      console.warn('[ChatService] Note marking messages as read:', err);
    }
  }
}

export const chatService = new ChatService();

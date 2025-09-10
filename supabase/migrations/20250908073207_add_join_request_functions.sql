-- Create RPC functions for handling league join requests

-- Function to approve a join request
CREATE OR REPLACE FUNCTION approve_join_request(request_id UUID)
RETURNS JSON AS $$
DECLARE
    request_record RECORD;
    result JSON;
BEGIN
    -- Get the join request details
    SELECT ljr.*, l.name as league_name
    INTO request_record
    FROM league_join_requests ljr
    JOIN leagues l ON ljr.league_id = l.id
    WHERE ljr.id = request_id AND ljr.status = 'pending';

    -- Check if request exists and is pending
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Request not found or already processed'
        );
    END IF;

    -- Check if current user is admin of the league
    IF NOT EXISTS (
        SELECT 1 FROM league_memberships 
        WHERE league_id = request_record.league_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Not authorized to approve requests for this league'
        );
    END IF;

    -- Update request status to approved
    UPDATE league_join_requests 
    SET status = 'approved', updated_at = NOW()
    WHERE id = request_id;

    -- Add user to league_memberships
    INSERT INTO league_memberships (league_id, user_id, role, joined_at)
    VALUES (request_record.league_id, request_record.user_id, 'member', NOW())
    ON CONFLICT (league_id, user_id) DO NOTHING;

    RETURN json_build_object(
        'success', true,
        'league_name', request_record.league_name,
        'user_id', request_record.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decline a join request
CREATE OR REPLACE FUNCTION decline_join_request(request_id UUID)
RETURNS JSON AS $$
DECLARE
    request_record RECORD;
BEGIN
    -- Get the join request details
    SELECT ljr.*, l.name as league_name
    INTO request_record
    FROM league_join_requests ljr
    JOIN leagues l ON ljr.league_id = l.id
    WHERE ljr.id = request_id AND ljr.status = 'pending';

    -- Check if request exists and is pending
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Request not found or already processed'
        );
    END IF;

    -- Check if current user is admin of the league
    IF NOT EXISTS (
        SELECT 1 FROM league_memberships 
        WHERE league_id = request_record.league_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Not authorized to decline requests for this league'
        );
    END IF;

    -- Update request status to declined
    UPDATE league_join_requests 
    SET status = 'declined', updated_at = NOW()
    WHERE id = request_id;

    RETURN json_build_object(
        'success', true,
        'league_name', request_record.league_name,
        'user_id', request_record.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending requests count for admin
CREATE OR REPLACE FUNCTION get_admin_pending_requests_count(league_id UUID)
RETURNS INTEGER AS $$
BEGIN
    -- Check if current user is admin of the league
    IF NOT EXISTS (
        SELECT 1 FROM league_memberships 
        WHERE league_memberships.league_id = get_admin_pending_requests_count.league_id
        AND user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RETURN 0;
    END IF;

    -- Return count of pending requests
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM league_join_requests 
        WHERE league_join_requests.league_id = get_admin_pending_requests_count.league_id
        AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending requests for admin with user details
CREATE OR REPLACE FUNCTION get_admin_pending_requests(league_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Check if current user is admin of the league
    IF NOT EXISTS (
        SELECT 1 FROM league_memberships 
        WHERE league_memberships.league_id = get_admin_pending_requests.league_id
        AND user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Not authorized to view requests for this league'
        );
    END IF;

    -- Get pending requests with user profile information
    SELECT json_build_object(
        'success', true,
        'requests', json_agg(
            json_build_object(
                'id', ljr.id,
                'league_id', ljr.league_id,
                'user_id', ljr.user_id,
                'username', COALESCE(p.username, p.display_name, split_part(u.email, '@', 1)),
                'created_at', ljr.created_at,
                'status', ljr.status
            )
            ORDER BY ljr.created_at DESC
        )
    )
    INTO result
    FROM league_join_requests ljr
    LEFT JOIN profiles p ON ljr.user_id = p.id
    LEFT JOIN auth.users u ON ljr.user_id = u.id
    WHERE ljr.league_id = get_admin_pending_requests.league_id
    AND ljr.status = 'pending';

    RETURN COALESCE(result, json_build_object('success', true, 'requests', '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent requests (approved/declined) for admin
CREATE OR REPLACE FUNCTION get_admin_recent_requests(league_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Check if current user is admin of the league
    IF NOT EXISTS (
        SELECT 1 FROM league_memberships 
        WHERE league_memberships.league_id = get_admin_recent_requests.league_id
        AND user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Not authorized to view requests for this league'
        );
    END IF;

    -- Get recent requests (last 7 days) with user profile information
    SELECT json_build_object(
        'success', true,
        'requests', json_agg(
            json_build_object(
                'id', ljr.id,
                'league_id', ljr.league_id,
                'user_id', ljr.user_id,
                'username', COALESCE(p.username, p.display_name, split_part(u.email, '@', 1)),
                'created_at', ljr.created_at,
                'updated_at', ljr.updated_at,
                'status', ljr.status
            )
            ORDER BY ljr.updated_at DESC
        )
    )
    INTO result
    FROM league_join_requests ljr
    LEFT JOIN profiles p ON ljr.user_id = p.id
    LEFT JOIN auth.users u ON ljr.user_id = u.id
    WHERE ljr.league_id = get_admin_recent_requests.league_id
    AND ljr.status IN ('approved', 'declined')
    AND ljr.updated_at > NOW() - INTERVAL '7 days'
    LIMIT 20;

    RETURN COALESCE(result, json_build_object('success', true, 'requests', '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
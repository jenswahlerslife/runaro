# Integration Instructions for Runaro Blog System

This document provides comprehensive instructions for replicating the Runaro blog system with admin capabilities. Follow these steps to integrate the exact same setup into your existing website.

---

## Table of Contents

1. [Overview](#overview)
2. [Supabase Backend Setup](#supabase-backend-setup)
3. [Frontend Dependencies](#frontend-dependencies)
4. [Frontend Components](#frontend-components)
5. [Authentication System](#authentication-system)
6. [File Upload & Image Management](#file-upload--image-management)
7. [Routing & Pages](#routing--pages)
8. [Design System](#design-system)

---

## Overview

The Runaro blog system is a full-stack blogging platform with:
- Public blog post listing and individual post pages
- Admin dashboard for creating/editing posts
- Image upload with cropping functionality
- Post preview before publishing
- Markdown support for post content
- Tag-based organization
- Draft/Published status management
- Role-based access control (admin system)

---

## Supabase Backend Setup

### 1. Database Schema

#### A. Create Enum for User Roles

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
```

#### B. Create Tables

**1. Profiles Table**

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Profiles are viewable by owner"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

**2. User Roles Table**

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);
```

**3. Posts Table**

```sql
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  reading_minutes INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP WITH TIME ZONE,
  author_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts
  FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id);

CREATE POLICY "Authenticated users can create posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can manage all posts"
  ON public.posts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

### 2. Database Functions

**A. Update Timestamp Trigger Function**

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Apply trigger to posts table
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apply trigger to profiles table
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

**B. Role Check Function (Security Definer)**

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
```

**C. Handle New User Registration**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (if you have access)
-- Note: This trigger should be created on the auth.users table
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user();
```

### 3. Storage Setup

**A. Create Storage Bucket**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true);
```

**B. Storage RLS Policies**

```sql
-- Allow public viewing of images
CREATE POLICY "Anyone can view post images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'post-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload post images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- Allow users to update their own uploads
CREATE POLICY "Users can update their own post images"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own post images"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'post-images' AND auth.role() = 'authenticated');
```

### 4. Authentication Configuration

Enable the following auth settings in Supabase:
- **Auto-confirm email signups**: Enabled (for development)
- **Email provider**: Enabled
- **Disable signup**: No (allow new users to register)

### 5. Manual Admin Role Assignment

To make a user an admin, manually insert a record into `user_roles`:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('[USER_UUID_HERE]', 'admin');
```

---

## Frontend Dependencies

Install the following npm packages:

```bash
npm install @supabase/supabase-js
npm install react-router-dom
npm install slugify
npm install react-markdown
npm install react-easy-crop
npm install @radix-ui/react-slider
npm install lucide-react
npm install sonner
npm install @tanstack/react-query
```

Shadcn UI components needed:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add card
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add toast
```

---

## Frontend Components

### 1. Authentication Hook (`src/hooks/use-auth.tsx`)

Create a custom authentication hook that manages:
- User session state
- Sign in/sign up/sign out functionality
- Admin role checking using the `has_role` function

Key features:
- Uses Supabase auth state listener
- Checks admin status on user load
- Provides authentication context to entire app

```typescript
// Key functionality:
const checkAdminStatus = async (userId: string) => {
  const { data } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: 'admin'
  });
  setIsAdmin(data || false);
};
```

### 2. Admin Editor Page (`src/pages/AdminEditor.tsx`)

Full-featured blog post editor with:

**State Management:**
- `title`, `slug`, `excerpt`, `content`
- `coverImageUrl`, `tags`, `readingMinutes`
- `status` (draft/published)
- `uploading`, `loading` states
- `tempImageForCrop`, `showCropDialog`, `showPreview`

**Key Functions:**
- `handleTitleChange`: Auto-generates slug from title using slugify
- `handleFileUpload`: Validates image (type, size), shows crop dialog
- `handleCropComplete`: Converts cropped image to blob, uploads to Supabase
- `handleRemoveImage`: Clears cover image
- `handleSave`: Saves/updates post in database
- `handleOpenPreview`: Opens preview modal

**Validation:**
- Max 5MB image size
- Image files only
- Required fields: title, excerpt, content

### 3. Image Crop Dialog (`src/components/admin/ImageCropDialog.tsx`)

Uses `react-easy-crop` library:

**Features:**
- 16:9 aspect ratio cropping
- Zoom slider (1x to 3x)
- Drag to reposition
- Converts cropped area to blob for upload

**Key Functions:**
- `getCroppedImg`: Creates canvas, draws cropped portion, returns blob URL
- `onCropCompleteHandler`: Stores cropped area pixel data

### 4. Post Preview (`src/components/admin/PostPreview.tsx`)

Modal preview showing:
- Cover image (16:9 aspect ratio)
- Tags as badges
- Title with headline font
- Reading time with clock icon
- Excerpt with border accent
- Markdown-rendered content using `react-markdown`

### 5. Admin Dashboard (`src/pages/Admin.tsx`)

Lists all posts with:
- Search/filter functionality
- Status indicators (draft/published)
- Edit/delete actions
- Create new post button
- Protected route (admin-only access)

### 6. Admin Post List (`src/components/admin/AdminPostList.tsx`)

Table component showing:
- Post title, status, tags
- Publish date, reading time
- Edit and delete buttons
- Real-time updates

### 7. Public Pages

**Index Page (`src/pages/Index.tsx`):**
- Hero section with background image
- Grid of published posts (3 columns)
- Uses PostCard component

**Post Page (`src/pages/Post.tsx`):**
- Full post view with cover image
- Markdown content rendering
- Tags, reading time, publish date
- SEO meta tags

**Post Card (`src/components/PostCard.tsx`):**
- Compact post preview
- Cover image, title, excerpt
- Tags and reading time
- Click to view full post

**About Page (`src/pages/Om.tsx`):**
- Static about page
- Contact information

### 8. Authentication Pages

**Auth Page (`src/pages/Auth.tsx`):**
- Toggle between sign in/sign up
- Email and password fields
- Full name field for registration
- Error handling with toast notifications

---

## Routing & Pages

### Route Structure (`src/main.tsx` or `src/App.tsx`)

```typescript
<Routes>
  <Route path="/" element={<Index />} />
  <Route path="/post/:slug" element={<Post />} />
  <Route path="/om" element={<Om />} />
  <Route path="/auth" element={<Auth />} />
  <Route path="/admin" element={<Admin />} />
  <Route path="/admin/editor" element={<AdminEditor />} />
  <Route path="/admin/editor/:id" element={<AdminEditor />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

### Protected Routes

Admin pages check for authentication and admin role:

```typescript
useEffect(() => {
  if (!authLoading && !user) {
    navigate("/auth");
  }
}, [user, authLoading, navigate]);
```

---

## File Upload & Image Management

### Upload Flow

1. User clicks "Upload billede" button
2. File input opens (accept="image/*")
3. **Validation:**
   - Check file type (must be image)
   - Check file size (max 5MB)
4. Convert to data URL using FileReader
5. Open ImageCropDialog with image
6. User crops/zooms image
7. Convert cropped area to blob
8. Upload blob to Supabase storage bucket `post-images`
9. Get public URL and set as `coverImageUrl`

### Re-cropping Existing Images

- Click crop button on existing image preview
- Opens same ImageCropDialog
- Re-uploads cropped version to storage

---

## Design System

### Color Tokens (HSL values in `src/index.css`)

Uses semantic color tokens:
- `--primary`: Main brand color
- `--secondary`: Secondary accent
- `--muted`: Subtle backgrounds
- `--accent`: Highlight color
- `--destructive`: Error/delete actions
- `--border`: Border colors
- Dark mode variants with `.dark` class

### Typography

- Headline font: Applied to post titles
- Body font: Applied to content
- Font sizes defined in Tailwind config

### Component Styling

All components use:
- Tailwind CSS utility classes
- Semantic color tokens (never hardcoded colors)
- Responsive design (mobile-first)
- Dark mode support

---

## Key Integration Steps Summary

1. **Set up Supabase project** with all tables, functions, and storage
2. **Configure authentication** settings
3. **Manually assign admin role** to your user account
4. **Install all frontend dependencies**
5. **Copy authentication hook** (`use-auth.tsx`)
6. **Copy admin pages and components**
7. **Set up routing** with protected routes
8. **Configure Supabase client** with your project credentials
9. **Test the entire flow:**
   - Register/login
   - Create draft post
   - Upload and crop image
   - Preview post
   - Publish post
   - View on public site

---

## Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

---

## Security Considerations

1. **RLS Policies:** All tables have Row-Level Security enabled
2. **Admin Check:** Uses Security Definer function to prevent RLS recursion
3. **Image Validation:** Client-side validation for file type and size
4. **Storage Policies:** Authenticated users only can upload
5. **Protected Routes:** Admin pages check authentication status
6. **Role-Based Access:** Separate `user_roles` table prevents privilege escalation

---

## Testing Checklist

- [ ] User can register and log in
- [ ] Admin role is properly assigned
- [ ] Admin can create new posts
- [ ] Image upload works and validates file size/type
- [ ] Image cropping works correctly
- [ ] Post preview displays correctly
- [ ] Draft posts are saved
- [ ] Published posts appear on homepage
- [ ] Non-admin users cannot access admin pages
- [ ] Public users can view published posts only
- [ ] Post detail pages load correctly with markdown rendering
- [ ] Tags are displayed properly
- [ ] Reading time calculation is accurate

---

## Troubleshooting

**Issue: User can't access admin page**
- Check if admin role is assigned in `user_roles` table
- Verify `has_role` function is created with SECURITY DEFINER
- Check authentication state in browser dev tools

**Issue: Images not uploading**
- Verify storage bucket `post-images` is created and public
- Check storage RLS policies are in place
- Ensure file size is under 5MB
- Check browser console for errors

**Issue: Posts not visible on homepage**
- Verify post status is set to 'published'
- Check `published_at` timestamp is set
- Verify RLS policy allows public SELECT on published posts

**Issue: Markdown not rendering**
- Ensure `react-markdown` is installed
- Check prose classes are applied to content container
- Verify Tailwind typography plugin is configured

---

## Additional Notes

- The slug is auto-generated from the title using `slugify` library
- Reading time defaults to 5 minutes but can be manually adjusted
- Tags are comma-separated in the input, converted to array for storage
- Cover images are stored in Supabase storage with public access
- All timestamps use `timestamp with time zone` for consistency
- The system uses Danish locale for date formatting

---

## File Structure Reference

```
src/
├── components/
│   ├── admin/
│   │   ├── AdminPostList.tsx
│   │   ├── ImageCropDialog.tsx
│   │   └── PostPreview.tsx
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── dialog.tsx
│   │   ├── slider.tsx
│   │   └── ... (other shadcn components)
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── PostCard.tsx
├── hooks/
│   └── use-auth.tsx
├── pages/
│   ├── Index.tsx
│   ├── Post.tsx
│   ├── Om.tsx
│   ├── Auth.tsx
│   ├── Admin.tsx
│   ├── AdminEditor.tsx
│   └── NotFound.tsx
├── integrations/
│   └── supabase/
│       ├── client.ts
│       └── types.ts
├── lib/
│   └── utils.ts
└── main.tsx
```

---

This document should provide everything needed to replicate the Runaro blog system exactly as implemented.

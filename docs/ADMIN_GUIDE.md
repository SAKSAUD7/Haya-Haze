# Haya & Haze — Admin Guide

For the people who run the store day to day. There are two places to sign in, with the
same email and password:

- **Admin portal** `/admin/` — products, stock, orders, customers, coupons, settings
- **CMS** `/cms/` — the home page, About, FAQ, policies, journal, lookbook

## The dashboard

The first screen shows revenue (today, 7 days, 30 days), average order value, new
customers and abandoned carts. Below that are four tiles that tell you what needs
doing now — click any of them to go straight to the list:

- **Orders to pack** — paid or confirmed orders waiting for you
- **COD orders to verify** — call or message the customer before shipping
- **Return requests** — waiting for a decision
- **Reviews to moderate** — waiting for approval

## Fulfilling an order

Open the order and use the buttons at the top. An order moves through:

**Pending payment → Confirmed → Packed → Shipped → Out for delivery → Delivered**

1. **Verify COD** (Cash on Delivery orders only). Confirm the order with the customer,
   then press *Verify COD*. COD orders cannot be shipped until this is done.
2. **Advance to next status** moves Confirmed → Packed once it is packed.
3. **Create shipment**. With Shiprocket connected this books the courier, saves the
   tracking number and marks the order Shipped. Without Shiprocket, type the courier and
   AWB into the *Shipments* section, save, then press *Advance to next status*.
4. Tracking updates from Shiprocket move the order to Out for delivery and Delivered on
   their own. You can also advance it by hand.

The customer is emailed at every step. **Invoice** and **Packing slip** open printable
documents. **Cancel order** returns the stock; **Refund in full** sends the money back
through the original payment method. Use the *Timeline* section to add a note — tick
*Is public* if the customer should see it.

To move many orders at once, tick them in the list and choose *Advance selected to the
next status*.

## Products

**Catalogue → Products → Add.** The form has tabs:

- **Product** — name, description, fabric & care, category, collection, fabric type
- **Pricing & tax** — price, compare-at price (shows the % off badge), HSN code, GST %
- **Visibility** — Draft/Active, an optional publish date, and the flags:
  *Top Pick* (appears in the 3D hero), *In Wardrobe* (appears in the 3D wardrobe; choose
  rail or shelf), *New*, *Bestseller*, *Featured*
- **Fabric in Motion (3D)** — how the product looks in 3D (see below)
- **Related & SEO** — "Complete the look" products, search title and description

Under the tabs, add **Variants** (one row per colour/size/length, each with its own SKU
and stock) and **Images** (drag to reorder; set *Colour name* on an image to show it
when that colour is chosen).

From the product list you can tick the flags directly, duplicate products, and import or
export CSV.

### How products appear in 3D

Nothing extra is needed. When you add the first image and save, the background is
removed automatically and the cut-out becomes the 3D cloth. For the best result,
photograph products flat on a plain Ivory Cream or Blush Sand background.

- **Shape preset** — *Hanging garment* for abayas and dresses, *Draped over a bar* for
  hijabs and scarves, *Flat* for anything else.
- **Fabric** (on the Product tab) sets how it moves: silk floats and shines, crepe
  swings heavily, jersey barely ripples.
- Not happy with the cut-out? Upload your own transparent PNG/WebP and tick *Keep my
  uploaded cut-out*, or press *Regenerate 3D cut-out*.

## Stock

**Catalogue → Inventory** lists every variant. Type a new number in *Stock* and save;
the change is recorded under *Stock movements* with your name. Filter by *Sold out* or
*Low stock* to see what needs reordering. You cannot set stock below the quantity held
by unpaid orders.

Customers who asked to be told when something returns are under *Back-in-stock
requests*; they are emailed automatically when stock is added.

## Coupons and gift cards

**Marketing → Coupons.** Choose a type (percentage, flat amount, free shipping, or buy
one get one), then any conditions: minimum order, dates, first order only, particular
collections or products, total uses and uses per customer. *Auto apply* applies the
coupon at checkout without a code.

**Gift cards** are created with a balance; the code is generated for you.

## Abandoned carts

**Marketing → Abandoned carts** shows bags left with items in them. One reminder email
is sent automatically after a few hours when we have the shopper's email. Select carts
and choose *Send recovery email now* to send one by hand.

## Reviews and returns

- **Reviews** arrive as *Awaiting moderation*. Select and *Approve*, *Reject*, or
  *Approve and feature on the home page*. You can write a public reply in the review.
- **Returns**: open the request, check the photos, then use the buttons in order:
  *Approve* → *Pickup scheduled* → *Item received* → *Refund / send exchange*. For a
  refund, check *Refund amount* first. Write anything the customer should know in
  *Admin note* — it is included in the email they receive.

## Store settings

**Content & settings → Store settings** holds contact details and WhatsApp number,
shipping rates and the free-shipping threshold, COD fee and limits, GST defaults, the
welcome popup, Google Analytics and Meta Pixel IDs, and the look of the 3D wardrobe
(wood tone and light warmth). The *Integrations* tab shows which payment and shipping
keys are set; the keys themselves are configured on the server.

**Announcements** are the rotating messages in the bar at the top of the site.
**Serviceable pincodes** control where you deliver, COD availability and delivery times
per pincode (import a CSV to add many).

## Editing pages (CMS)

In `/cms/`, open **Pages → Home**. The home page is a list of sections you can edit,
drag to reorder, or switch off with *Enabled*. Press **Preview** to see a draft on the
real site before publishing; press **Publish** to make it live (changes appear within a
minute or two).

About, FAQ, Size Guide and the policy pages are under Home. Journal posts live under
**The Journal**. The **Lookbook** page takes images with hotspots: for each hotspot set
the product and its position as a percentage from the left and from the top.

## Roles

**Content & settings → Staff & roles.** Create the person under *Customers*, tick
*Staff status*, and add them to a group:

| Role | Can do |
|---|---|
| Super Admin | Everything |
| Store Manager | Products, stock, orders, shipping, coupons, reviews, returns, settings |
| Content Editor | Product text and images, announcements, reviews, all CMS pages |
| Support | View and update orders and returns, read customers, answer messages |

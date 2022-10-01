module Jekyll
  module Feeds
    class CategoryFeed < Page
      def initialize(site, base, dir, category)
        @site = site
        @base = base
        @dir = dir
        @name = 'rss.xml'

        self.process(@name)
        self.read_yaml(File.join(base, '_layouts', 'feed'), 'category.xml')
        self.data['category'] = category

        category_title_prefix = site.config['category_title_prefix'] || 'Category: '
        self.data['title'] = "#{category_title_prefix}#{category}"
      end

      def extname
        File.extname(@name)
      end
    end

    class FeedGenerator < Generator
      safe true

      def generate(site)
        if site.layouts.key? 'feed/category'
          site.categories.keys.each do |category|
            write_category_feed(site, File.join('categories', category.gsub(/\s/, "-").gsub(/[^\w-]/, '').downcase), category)
          end
        end
      end

      def write_category_feed(site, dir, category)
        index = CategoryFeed.new(site, site.source, dir, category)
        index.render(site.layouts, site.site_payload)
        index.write(site.dest)
        site.static_files << index
      end
    end
  end
end

import React from 'react';
import { motion } from 'motion/react';

interface AboutSectionProps {
  profile: any;
  aboutBio?: string | null;
}

export const AboutSection = ({ profile, aboutBio }: AboutSectionProps) => {
  if (aboutBio === null || !profile.bio) return null;

  const displayBio = aboutBio || profile.bio;

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <img
            src={profile.portfolio?.[0]?.url || profile.avatar}
            alt="Trabalho"
            className="w-full aspect-[4/5] object-cover rounded-[48px] filter saturate-[0.8] grayscale-[0.2]"
            referrerPolicy="no-referrer"
          />
          <img
            src={profile.avatar || profile.portfolio?.[0]?.url}
            alt="Profissional"
            className="absolute -bottom-8 -right-8 w-1/2 aspect-square object-cover rounded-[32px] border-8 border-brand-parchment shadow-2xl hidden md:block"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-8"
        >
          <span className="label-text text-brand-terracotta">A Profissional</span>
          
          <h2 className="heading-section text-brand-ink">
            Beleza que<br />
            <em className="font-serif italic text-brand-stone">pertence a você</em>
          </h2>

          <p className="body-text text-brand-stone border-l-2 border-brand-blush pl-8">
            {displayBio}
          </p>

          {profile.professionalIdentity?.differentials && (
            <div className="flex flex-wrap gap-2 pt-4">
              {profile.professionalIdentity.differentials.map((diff: string) => (
                <div key={diff} className="flex items-center gap-2 px-4 py-2 bg-brand-white border border-brand-mist rounded-full text-[9px] font-bold uppercase tracking-widest text-brand-ink">
                  <div className="w-1 h-1 rounded-full bg-brand-terracotta" />
                  {diff}
                </div>
              ))}
            </div>
          )}

          <div className="font-signature text-5xl text-brand-ink/20 pt-8">
            {profile.name.split(' ')[0]}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

import React from 'react'
import { LockToggle } from './LockToggle'

interface Props {
    title: string
    /** Controlled open state. On desktop the section body is always shown via
     *  CSS regardless of this value. On compact, it controls visibility. */
    open: boolean
    onToggle: () => void
    lock?: {
        locked: boolean
        onToggle: () => void
        labels?: {
            locked: string
            unlocked: string
            titleLocked?: string
            titleUnlocked?: string
        }
    }
    children: React.ReactNode
}

/**
 * Collapsible section. On compact (mobile / tablet) the header is a button
 * that toggles the body. On desktop the body is always visible — CSS handles
 * that override so the user gets the desktop "everything-at-once" experience.
 */
export const Section: React.FC<Props> = ({ title, open, onToggle, lock, children }) => {
    return (
        <div className={`section ${open ? 'is-open' : 'is-closed'}`}>
            <div className="section-head">
                <button
                    type="button"
                    className="section-toggle"
                    onClick={onToggle}
                    aria-expanded={open}
                >   
                    <span className="subtitle">{title}</span>
                    <div className='section-head-right'>
                    {lock && (
                        <LockToggle
                            locked={lock.locked}
                            onToggle={lock.onToggle}
                            labels={lock.labels}
                        />
                    )}
                    <span className="section-chevron" aria-hidden />
                    </div>
                </button>

            </div>
            <div className="section-body">
                {children}
            </div>
        </div>
    )
}
